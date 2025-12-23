# TypeScript / Next.js / NestJS 入門（給第一次接觸的人）

這份文件不是要把所有細節講完，而是讓你「看得懂這個專案在做什麼」，知道每一層在負責什麼，以及你要去哪裡改東西。

## 1) TypeScript 是什麼？（先破除最大誤解）
**TypeScript（TS）不是新的執行環境**。瀏覽器與 Node.js 最終跑的仍然是 JavaScript（JS）。

你可以把 TS 想成：
- 在寫程式時多了一套「型別規則」幫你抓錯（例如把字串當成數字用）
- 寫完後會被編譯成 JS 才能執行

### 型別的價值（為什麼我們選 TS）
在這種「資料結構多、流程複雜」的系統（借還、預約、政策）裡，很多 bug 不是演算法問題，而是：
- 欄位名稱用錯（`due_at` 寫成 `dueAt`）
- 狀態值打錯（`checkedout` vs `checked_out`）
- 前端以為 API 會回某個欄位，但後端沒回

TS 的目標是讓這些錯誤**更早**（在寫程式/編譯時）被發現。

### 你會常看到的 TS 語法（最小集合）
```ts
type UserRole = 'admin' | 'librarian' | 'teacher' | 'student';

type User = {
  id: string;
  external_id: string;
  name: string;
  role: UserRole;
};
```
- `type`：定義一個型別
- `|`：聯集（union），代表「可能是其中之一」
- 物件型別：把欄位與型別寫清楚

> 重要觀念：型別只存在於「編譯前」，執行時不會自動幫你驗證資料，所以後端仍需要做 runtime validation（例如用 `zod`）。

## 2) Node.js 是什麼？（後端為什麼能跑）
Node.js 是「在伺服器端執行 JavaScript」的執行環境。
- 前端 JS 跑在瀏覽器
- 後端 JS/TS（編譯後的 JS）跑在 Node.js

`package.json` 是 Node 生態裡的核心：
- 宣告這個專案叫什麼、有哪些依賴（dependencies）
- 定義常用指令（scripts），例如 `npm run dev`

## 3) Next.js 是什麼？（前端框架）
Next.js 是建立在 React 之上的框架，幫你處理：
- 路由（網址對應頁面）
- 打包與編譯
- Server-side rendering（SSR）/ Server Components（依設定而定）

在 `apps/web/` 我們採用 Next.js 的 **App Router**（你會看到 `app/` 資料夾）：
- `apps/web/app/page.tsx`：首頁
- `apps/web/app/layout.tsx`：全站共用版型（外框）

### React 元件是什麼？
你可以把元件當成「可重用的 UI 函式」：
```tsx
export default function Hello({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}
```
它回傳的是 JSX（看起來像 HTML 的語法），最後由 React/Next 轉成瀏覽器能理解的 DOM。

## 4) NestJS 是什麼？（後端框架）
NestJS 是「偏大型專案」的 Node 後端框架，重點在：
- 以 Module/Controller/Service 組織程式
- 使用 DI（Dependency Injection）降低耦合、利於測試

在 `apps/api/` 你會看到：
- `src/app.module.ts`：主模組（AppModule）
- `src/health/health.controller.ts`：健康檢查控制器
- `src/main.ts`：啟動伺服器

### Controller（控制器）在做什麼？
Controller 負責「接 HTTP request，回 response」。
```ts
@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { ok: true };
  }
}
```
`@Get()` 表示這是一個 GET 路由；回傳物件會被轉成 JSON。

### Service（服務）會放在哪？
當你開始做借還流程時，商業邏輯應該放在 Service（例如 `CirculationService.checkout()`），Controller 只負責收參數與回結果。

## 5) PostgreSQL 在這裡扮演什麼角色？
PostgreSQL 是關聯式資料庫，強項是：
- 透過 constraint（限制）確保資料一致性（例如 barcode 唯一）
- 透過 transaction（交易）保證「借出」同時更新多張表仍能一致

例如在 `db/schema.sql` 我們用了「部分唯一索引（partial unique index）」：
- 保證同一冊同一時間只能有一筆未歸還借閱（避免重複借出）

## 6) 最重要的實務心法（你會一直用到）
1. **文件先行**：先對齊 user stories → API → data dictionary → schema，再寫程式。
2. **狀態集中管理**：借還/預約不要讓前端亂 patch；用動作端點統一處理。
3. **資料一致性優先**：寧願在 DB 加 constraint 把錯擋掉，也不要只靠程式碼「希望不會發生」。
4. **隱私預設保守**：借閱歷史、匯出、權限，都用最小化原則設計。

