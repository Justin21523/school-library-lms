# syntax=docker/dockerfile:1
#
# Playwright E2E runner image（真瀏覽器）
#
# 目標：
# - 讓 UI E2E 測試可以「在 Docker 內」穩定執行（不用在 host 裝瀏覽器/系統依賴）
# - 內建 Chromium/Firefox/WebKit 與必要系統依賴（由 Playwright 官方 image 提供）
#
# 注意：
# - Playwright image 很大，但換來的是「E2E 可重現」與「免安裝瀏覽器依賴」
# - 若你要縮小體積，可在未來做：
#   - 只跑 chromium（移除其他 browser）
#   - 或把 E2E workspace 拆出去（減少 npm 依賴範圍）

# 版本需與 @playwright/test 對齊（避免 browser binary 缺失）
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /workspace

# 先只拷貝 package manifests 以利用 Docker layer cache（加速 npm ci）
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY tsconfig.base.json ./

# 安裝整個 monorepo 依賴（npm workspaces 共享一份 lockfile）
RUN npm ci

# 拷貝 E2E 測試與 runner scripts（不需要把整個 apps/ 帶進來）
COPY playwright.config.ts ./playwright.config.ts
COPY tests ./tests
COPY scripts ./scripts

CMD ["npx", "playwright", "test", "--config=playwright.config.ts"]
