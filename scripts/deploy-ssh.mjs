/**
 * SSH Deploy（最小可用版）
 *
 * 目的：
 * - 把目前 repo（排除 node_modules / test artifacts）打包上傳到遠端
 * - 在遠端用 docker compose build/up 跑起來
 *
 * 安全提醒：
 * - 不要把私鑰貼到聊天或 commit 到 repo
 * - 建議用 ssh-agent（或你本機既有的 ~/.ssh/config）
 * - `.env` 可能包含 secret：此腳本預設不會自動上傳 `.env`，要你明確指定才會 copy
 *
 * 使用方式（本機執行）：
 *   DEPLOY_SSH_HOST=1.2.3.4 \
 *   DEPLOY_SSH_USER=ubuntu \
 *   DEPLOY_REMOTE_DIR=/opt/school-library-lms \
 *   npm run deploy:ssh
 *
 * 可選：
 * - DEPLOY_SSH_PORT=22
 * - DEPLOY_SSH_IDENTITY_FILE=/abs/path/to/id_ed25519（建議；避免依賴 ssh-agent / ~/.ssh/config）
 * - DEPLOY_SEED=none|demo|scale（預設 none）
 * - DEPLOY_ENV_LOCAL_PATH=/path/to/.env（搭配 DEPLOY_COPY_ENV=1 才會上傳）
 * - DEPLOY_COPY_ENV=0|1（預設 0）
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

main();

function envStr(name, fallback = '') {
  const v = process.env[name];
  return v == null ? fallback : String(v).trim();
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function assertSafeValue(name, value, re, example) {
  if (!value) die(`[deploy:ssh] missing ${name}`);
  if (!re.test(value)) die(`[deploy:ssh] invalid ${name}=${JSON.stringify(value)} (example: ${example})`);
}

function run(cmd, args, options = {}) {
  const full = [cmd, ...args].join(' ');
  console.log(`[deploy:ssh] $ ${full}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (res.status !== 0) die(`[deploy:ssh] command failed (exit=${res.status ?? 'null'}): ${full}`);
}

function main() {
  const host = envStr('DEPLOY_SSH_HOST');
  const user = envStr('DEPLOY_SSH_USER');
  const port = envStr('DEPLOY_SSH_PORT', '22');
  const remoteDir = envStr('DEPLOY_REMOTE_DIR');
  const identityFile = envStr('DEPLOY_SSH_IDENTITY_FILE', '');

  // 只做最小的 injection 防護（避免把 value 直接拼進 shell 時出事）
  assertSafeValue('DEPLOY_SSH_HOST', host, /^[a-zA-Z0-9._-]+$/, 'example.com');
  assertSafeValue('DEPLOY_SSH_USER', user, /^[a-zA-Z0-9._-]+$/, 'ubuntu');
  assertSafeValue('DEPLOY_SSH_PORT', port, /^[0-9]{2,5}$/, '22');
  assertSafeValue('DEPLOY_REMOTE_DIR', remoteDir, /^\/[a-zA-Z0-9._/-]+$/, '/opt/school-library-lms');
  if (identityFile) {
    assertSafeValue(
      'DEPLOY_SSH_IDENTITY_FILE',
      identityFile,
      /^\/[a-zA-Z0-9._/-]+$/,
      '/home/you/.ssh/school-library-lms_live_dothost_ed25519',
    );
    if (!fs.existsSync(identityFile)) die(`[deploy:ssh] identity file not found: ${identityFile}`);
  }

  const seed = envStr('DEPLOY_SEED', 'none');
  if (!['none', 'demo', 'scale'].includes(seed)) die(`[deploy:ssh] invalid DEPLOY_SEED=${seed} (allowed: none|demo|scale)`);

  const copyEnv = envStr('DEPLOY_COPY_ENV', '0') === '1';
  const envLocalPath = envStr('DEPLOY_ENV_LOCAL_PATH', '');
  if (copyEnv) {
    if (!envLocalPath) die('[deploy:ssh] DEPLOY_COPY_ENV=1 requires DEPLOY_ENV_LOCAL_PATH');
    if (!fs.existsSync(envLocalPath)) die(`[deploy:ssh] env file not found: ${envLocalPath}`);
  }

  const target = `${user}@${host}`;
  const sshBaseArgs = identityFile ? ['-i', identityFile, '-o', 'IdentitiesOnly=yes'] : [];
  const sshArgs = [...sshBaseArgs, '-p', port];
  const scpArgs = identityFile ? ['-i', identityFile, '-o', 'IdentitiesOnly=yes', '-P', port] : ['-P', port];

  // 1) ensure remote dir exists
  run('ssh', [...sshArgs, target, `mkdir -p ${remoteDir}`]);

  // 2) upload repo via tar pipe（不依賴 rsync）
  //
  // 安全策略：
  // - 我們用 `git ls-files -co --exclude-standard` 取得「可部署檔案清單」：
  //   - c：tracked（git index）
  //   - o：untracked 但未被 .gitignore 忽略
  //   - --exclude-standard：尊重 .gitignore（因此 `.env` / `.env.*` 等敏感檔不會被打包）
  //
  // 這能避免一個常見事故：deploy 時不小心把本機的 `.env`（含 secret）一起上傳到遠端。
  //
  // 若 repo 不在 git worktree（極少見），才退回舊的 tar exclude 策略。
  const gitProbe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  const useGitList = gitProbe.status === 0;

  // 用 bash 方便做 pipe；remote 端也用 tar 解開
  const uploadCmd = useGitList
    ? `git ls-files -co --exclude-standard -z | tar --null -T - -czf -`
    : `tar --exclude=.git --exclude=node_modules --exclude=playwright-report --exclude=test-results --exclude=apps/web/.next --exclude=apps/api/dist --exclude=packages/shared/dist -czf - .`;

  const remoteExtractCmd = identityFile
    ? `ssh -i ${identityFile} -o IdentitiesOnly=yes -p ${port} ${target} 'tar -xzf - -C ${remoteDir}'`
    : `ssh -p ${port} ${target} 'tar -xzf - -C ${remoteDir}'`;

  run('bash', ['-lc', `${uploadCmd} | ${remoteExtractCmd}`]);

  // 3) optional: upload .env（你必須明確開啟）
  if (copyEnv) {
    run('scp', [...scpArgs, envLocalPath, `${target}:${remoteDir}/.env`]);
  } else {
    console.log('[deploy:ssh] skip .env upload (DEPLOY_COPY_ENV=0)');
  }

  // 4) docker compose up（remote）
  // 某些主機（像你這台）會只有 `docker-compose`（v2 binary），而沒有 `docker compose` plugin subcommand。
  // 因此我們在遠端用一個小 wrapper 自動偵測兩種命令，避免部署卡在 compose 版本差異。
  const remoteCompose =
    `compose(){ ` +
    `if docker compose version >/dev/null 2>&1; then docker compose \"$@\"; ` +
    `elif command -v docker-compose >/dev/null 2>&1; then docker-compose \"$@\"; ` +
    `else echo \"[deploy:ssh] ERROR: neither 'docker compose' nor 'docker-compose' is available\"; exit 1; fi; ` +
    `};`;

  run('ssh', [...sshArgs, target, `cd ${remoteDir} && ${remoteCompose} compose up -d --build postgres redis api web`]);

  // 5) optional seed
  if (seed === 'demo') {
    run('ssh', [...sshArgs, target, `cd ${remoteDir} && ${remoteCompose} compose --profile demo run --rm seed`]);
  } else if (seed === 'scale') {
    run('ssh', [...sshArgs, target, `cd ${remoteDir} && ${remoteCompose} compose --profile scale run --rm seed-scale`]);
  }

  console.log('');
  console.log('[deploy:ssh] ✅ done');
  console.log(`[deploy:ssh] remote_dir=${remoteDir}`);
  console.log('[deploy:ssh] next: set APP_ENV/CORS_ORIGINS/NEXT_PUBLIC_API_BASE_URL in remote .env and rebuild web if needed');
}
