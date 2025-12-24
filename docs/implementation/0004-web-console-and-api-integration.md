# 實作說明 0004：Web Console（Next.js）＋ API 串接（依既有端點落地）

本文件說明我在第四輪實作完成的 **Web Console（前端）**：以 Next.js App Router 建立一個最小但可用的管理介面，**直接對齊既有 API 端點與多租戶邊界（orgId）**，讓你可以從瀏覽器完成「建主檔 → 建書目/冊 → 借還」的端到端流程。

> 延續你的學習需求：本輪新增/修改的前端 TypeScript 檔案都維持「高密度註解」，並在此文件用程式片段逐段落解釋原理與設計取捨。

---

## 1) 這一輪完成了什麼（對照 MVP / user stories）

對照 `USER-STORIES.md`（以「能操作」為優先）：
- **US-000 建立 organization**：已做（Web + API）
- **US-001 locations**：已做（Web + API）
- **US-002 circulation policies**：已做（Web + API）
- **US-020 新增/編輯書目**：已做（Web + API；含 PATCH）
- **US-021 新增多冊**：已做（Web + API）
- **US-030 搜尋館藏**：已做（Web + API：query/isbn/classification）
- **US-040 借出 / US-041 歸還**：已做（Web + API；含 actor_user_id）

> 仍未做：CSV 匯入、續借、預約（holds）完整管理 UI、報表匯出、稽核查詢 UI。

---

## 2) Web 路由如何對齊 API（為什麼這樣設計）

你會看到 Web 的 URL 結構刻意跟 API 的多租戶邊界一致：
- Web：`/orgs/:orgId/...`
- API：`/api/v1/orgs/:orgId/...`

這樣做的好處是：
1. **降低前後端對「org 範圍」理解不一致**的風險（永遠在同一層級帶著 orgId）。
2. UI 導覽更直覺：選了某個 org，就在該 org 的側邊欄切換 locations/users/policies…。

對應檔案：
- `apps/web/app/orgs/layout.tsx`：org 區域的 topbar
- `apps/web/app/orgs/[orgId]/layout.tsx`：單一 org 的側邊導覽

---

## 3) API 呼叫集中在 `api.ts`（為什麼不把 URL 分散在每個頁面）

這輪的核心是先把「Web → API 呼叫」的共用問題集中處理：
- base URL（本機預設 `http://localhost:3001`，也可用 env 覆蓋）
- 統一 JSON headers 與 parse
- 非 2xx 的錯誤格式（轉成 `ApiError` 丟出）
- query string 的組裝（避免拼錯/塞入 undefined）

對應檔案：
- `apps/web/app/lib/api.ts`
- `apps/web/app/lib/error.ts`

### 3.1 requestJson：成功/失敗都嘗試 parse JSON
`apps/web/app/lib/api.ts`
```ts
const text = await response.text();
const json = text ? (JSON.parse(text) as unknown) : null;

if (!response.ok) {
  const body = isApiErrorBody(json) ? json : null;
  const message = body?.error?.message ?? `HTTP ${response.status}`;
  throw new ApiError(message, response.status, body);
}

return json as T;
```
重點說明：
1. `response.text()` 是因為錯誤時也可能有 JSON body；先拿文字再決定要不要 parse。
2. `response.ok` 為 false 時，統一丟出 `ApiError`，讓各頁面用同一套方式顯示錯誤。
3. `isApiErrorBody` 是 runtime guard，避免「錯誤 shape 不符」導致前端 crash。

### 3.2 NEXT_PUBLIC_API_BASE_URL：為什麼要用 public env
`apps/web/app/lib/api.ts`
```ts
const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (fromEnv) return fromEnv;
return 'http://localhost:3001';
```
重點說明：
1. Web 的 fetch 是在瀏覽器發出，因此 baseUrl 必須在前端可取得。
2. `NEXT_PUBLIC_` 代表會被打包進前端，所以**不要放 secret**（這裡只是 URL，安全）。

---

## 4) 為什麼 Web 的 tsconfig 要補 DOM lib

根目錄 `tsconfig.base.json` 是給「全 monorepo」共用的預設，偏向後端/Node（只有 `ES2022`）。  
但 Web 需要 DOM 型別（例如 `HTMLInputElement.value`），所以在 `apps/web/tsconfig.json` 覆蓋：

`apps/web/tsconfig.json`
```json
"lib": ["DOM", "DOM.Iterable", "ES2022"]
```

這樣做的好處：
- 不需要污染 API 端（後端不需要 DOM）
- Web 端的 TypeScript 才能正確理解 React 事件與 DOM 型別

---

## 5) UI 如何把「部分更新（PATCH）」做得不容易誤改

書目與冊的更新 API 是 `PATCH`，代表：
- 只更新 request body 有提供的欄位
- 沒提供的欄位不動

因此 Web 採用「勾選欄位」的方式組 payload（避免使用者只是打開頁面就把空值送出去）。

### 5.1 書目更新（勾選欄位 → 組 PATCH payload）
對應檔案：`apps/web/app/orgs/[orgId]/bibs/[bibId]/page.tsx`
```ts
const payload: { title?: string; publisher?: string | null; ... } = {};

if (updateTitle) payload.title = title.trim();
if (updatePublisher) payload.publisher = publisher.trim() ? publisher.trim() : null;

if (Object.keys(payload).length === 0) {
  setError('請至少勾選一個要更新的欄位');
  return;
}
```
重點說明：
1. 勾選才會進 payload，避免誤更新。
2. 可選字串欄位用「空字串 → null」表達清空（對齊 API schema 的 nullable）。
3. payload 空就不送 request，避免 API 回 `No fields to update`。

### 5.2 冊更新（同樣用勾選欄位）
對應檔案：`apps/web/app/orgs/[orgId]/items/[itemId]/page.tsx`

這頁同樣採用「勾選欄位」＋「送 null 清空」的方式，並提供 location/status 下拉選單，降低輸入錯誤。

---

## 6) Circulation：為什麼需要先選 actor_user_id

目前專案尚未做登入/權限（auth/guards），但 circulation 一定要寫 audit_events。  
因此 Web 在借還頁會先載入 users，篩出可操作的角色（admin/librarian），再讓使用者選擇 `actor_user_id`：

對應檔案：`apps/web/app/orgs/[orgId]/circulation/page.tsx`

重點說明：
1. 先讓流程「可操作且可追溯」。
2. 未來若加入登入，`actor_user_id` 可改由 token 推導，UI 可以隱藏此欄位。

---

## 7) 如何手動驗證（端到端）

前置：
1. `docker compose up -d postgres`
2. 套用 `db/schema.sql`
3. 設定 `.env`（至少 `DATABASE_URL`）
4. `npm run dev`（同時跑 API + Web）

驗證路徑（建議順序）：
1. 打開 Web：`http://localhost:3000/orgs` 建立 organization
2. 進入該 org：
   - 建 locations（/locations）
   - 建 users（/users；至少建立一個 librarian 作為 actor）
   - 建 circulation policies（/circulation-policies；student/teacher）
3. 建書目與冊：
   - /bibs 建書目
   - 進入書目頁新增冊（需要選 location）
4. 借還：
   - /circulation 選 actor_user_id
   - checkout：輸入借閱者 external_id 與冊 barcode
   - checkin：輸入冊 barcode

---

## 8) 本輪新增/修改的主要檔案

- `apps/web/app/lib/api.ts`：API client（fetch + error wrapping + domain functions）
- `apps/web/app/lib/error.ts`：UI 錯誤格式化
- `apps/web/app/globals.css`：最小可用的全站樣式
- `apps/web/app/orgs/**`：Web Console 的主要頁面（orgs、locations、users、policies、bibs、items、circulation）
- `apps/web/tsconfig.json`：補上 DOM lib，讓 TS 正確理解瀏覽器型別

