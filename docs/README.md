# 文件導覽（給新加入的你）

這個倉庫同時包含「領域資料整理」與「可直接開發的 MVP 草案 + 專案骨架」。如果你對 TypeScript / Next.js 不熟，建議先照下面順序讀。

## 建議閱讀順序
1. 技術與架構決策：`ARCHITECTURE.md`
2. 系統怎麼跑起來（含目錄與流程）：`docs/how-it-works.md`
3. TypeScript / Next.js / NestJS 入門：`docs/typescript-nextjs-nestjs-primer.md`
4. 為什麼這樣設計（取捨與未來擴充）：`docs/design-rationale.md`
4.5. 先看資料模型全貌（ERD）：`docs/er-diagram.md`
5. 需求與落地：`MVP-SPEC.md`、`USER-STORIES.md`、`API-DRAFT.md`、`DATA-DICTIONARY.md`、`db/schema.sql`

## README（中英切換）
- 主要入口（繁體中文）：`README.md`
- English version：`README.en.md`

## 實作說明（Implementation Notes）
- `docs/implementation/0001-api-foundation-and-core-master-data.md`
- `docs/implementation/0002-bibliographic-and-item-copies.md`
- `docs/implementation/0003-circulation-checkout-checkin.md`
- `docs/implementation/0004-web-console-and-api-integration.md`

## 註解規範
- `docs/commenting-guidelines.md`

## 文件維護規則（很重要）
- 每次調整「需求/資料欄位/API/架構」其中之一，請同步更新對應文件，避免文件與實作脫節。
- 若你要新增重大決策（例如改資料庫、改驗證方式、加入 SSO），請把「原因、替代方案、取捨」寫進 `docs/design-rationale.md`（或另開決策文件）。
