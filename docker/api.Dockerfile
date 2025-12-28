# syntax=docker/dockerfile:1
#
# API container（NestJS）
# 目標：
# - `docker compose up --build api` 可以直接跑起來（不依賴本機 node_modules）
# - 以「可重現」為優先：用 `npm ci`（lockfile）確保依賴一致
#
# 設計取捨（MVP/開發環境取向）：
# - 這裡不做極致瘦身（不拆 production deps），先把可運行與可理解放在第一順位
# - 未來若要上 production，再把 node_modules 精簡/改成 multi-stage + prune/standalone

FROM node:20-bookworm-slim AS deps

WORKDIR /workspace

# 先只複製 package.json/lockfile（提高 Docker layer cache 命中率）
# - npm workspaces 需要各 workspace 的 package.json 才能正確解析
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS build

WORKDIR /workspace

# build 需要 tsconfig 與 source code
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

# build API（輸出到 apps/api/dist）
RUN npm run build -w @library-system/api

FROM node:20-bookworm-slim AS runtime

WORKDIR /workspace

ENV NODE_ENV=production

# runtime 只需要：node_modules + compiled dist
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist

# 讓 Dockerfile 本身文件化：API 預設 3001（實際以 docker-compose.yml port mapping 為準）
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]

