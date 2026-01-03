# syntax=docker/dockerfile:1
#
# Web container（Next.js）
# 目標：
# - `docker compose up --build web` 可以直接跑起來（不依賴本機 node_modules）
# - 以「可重現」為優先：用 `npm ci`（lockfile）確保依賴一致
#
# 注意（Next 的 NEXT_PUBLIC_*）：
# - `NEXT_PUBLIC_API_BASE_URL` 會被打包進前端，因此不要放 secret
# - 目前 web/app/lib/api.ts 預設會打 `http://localhost:3001`，剛好對應 docker compose 的 port mapping

FROM node:20-bookworm-slim AS deps

WORKDIR /workspace

# 先複製 package.json/lockfile（提高 cache 命中率）
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS build

WORKDIR /workspace

COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

# build Web（輸出到 apps/web/.next）
# - 注意：NEXT_PUBLIC_* 會被打包進前端，因此要在 build 階段注入才會生效
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build -w @library-system/shared && npm run build -w @library-system/web

FROM node:20-bookworm-slim AS runtime

WORKDIR /workspace

ENV NODE_ENV=production

# Next start 需要 node_modules + apps/web（含 .next 產物）
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/apps/web ./apps/web

EXPOSE 3000

# `next start` 要能被 host 連到，因此指定 host=0.0.0.0
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "-p", "3000", "-H", "0.0.0.0"]
