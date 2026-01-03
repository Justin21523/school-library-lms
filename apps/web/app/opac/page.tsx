/**
 * OPAC 首頁（/opac）
 *
 * 讀者端在 MVP 階段先提供：
 * - 選擇學校（org）
 * - 搜尋書目並預約（place hold）
 * - 查詢/取消自己的預約
 *
 * 版本演進：
 * - 已支援 OPAC Account（讀者登入）：可安全使用 `/me/*`（我的借閱/我的預約）
 * - 仍保留 `user_external_id` 模式作為過渡（可用但不安全）
 */

import Link from 'next/link';

import { NavIcon } from '../components/layout/nav-icons';
import { NavTile } from '../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../components/ui/page-header';

export default function OpacHomePage() {
  return (
    <div className="stack">
      <PageHeader
        title="OPAC（讀者自助）"
        description="先選擇學校（organization），再搜尋書目並預約（holds），或查看「我的借閱/我的預約」。"
        actions={
          <Link className="btnSmall btnPrimary" href="/opac/orgs">
            開始使用：選擇學校
          </Link>
        }
      >
        <AlertHint />
      </PageHeader>

      <section className="panel">
        <SectionHeader title="入口" description="以卡片式入口降低迷路成本；每個 org 內會有搜尋/借閱/預約/登入導覽。" />
        <div className="tileGrid">
          <NavTile
            href="/opac/orgs"
            icon={<NavIcon id="opac" size={20} />}
            title="選擇學校（Organization）"
            description="進入你所在的學校範圍後再開始搜尋/預約。"
            right={<span className="muted">/opac/orgs</span>}
          />
          <NavTile
            href="/orgs"
            icon={<NavIcon id="dashboard" size={20} />}
            title="Web Console（館員後台）"
            description="若你是館員/管理者，可切換到後台進行編目、權威控制與流通管理。"
            right={<span className="muted">/orgs</span>}
          />
        </div>
      </section>
    </div>
  );
}

function AlertHint() {
  return (
    <div className="callout">
      <div style={{ fontWeight: 900 }}>安全性提醒</div>
      <div className="muted" style={{ marginTop: 6 }}>
        建議使用 OPAC Account 登入（student/teacher），以安全地查看「我的借閱/我的預約」。
        <br />
        未登入時仍可用 <code>user_external_id</code>（學號/員編）進行預約（過渡模式；安全性較低）。
      </div>
    </div>
  );
}
