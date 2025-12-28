# 實作說明 0001：API 基礎層 + 核心主檔（organizations/locations/users/policies）

本文件說明我在第一輪程式實作做了什麼、為什麼這樣做、以及背後的原理。這一輪的目標是把 MVP 開發「先能跑、能存資料、能沿著資料模型擴充」的地基打好。

> 另外：依你後續的學習需求，我已在這一輪新增/修改的 TypeScript 與 SQL 檔案中加入大量註解；你可以直接打開程式碼把註解當教材閱讀。

## 1) 這一輪完成了什麼（對照 MVP/故事）
對照 `USER-STORIES.md`：
- **US-000 建立 organization**：已做（API）
- **US-001 locations**：已做（API）
- **US-002 circulation policies**：已做（API）
- **US-010 匯入名冊（CSV）**：尚未做（會牽涉檔案上傳/背景任務，下一輪再做）
- 其餘借還/預約/報表：尚未做（需要先有 organization/users/locations/policies）

對照 `API-DRAFT.md`（v1）目前已落地端點：
- `POST /api/v1/orgs`
- `GET /api/v1/orgs`
- `GET /api/v1/orgs/:orgId`
- `GET /api/v1/orgs/:orgId/locations`
- `POST /api/v1/orgs/:orgId/locations`
- `GET /api/v1/orgs/:orgId/users`
- `POST /api/v1/orgs/:orgId/users`
- `GET /api/v1/orgs/:orgId/circulation-policies`
- `POST /api/v1/orgs/:orgId/circulation-policies`

> 註：`/health` 仍在根路徑，方便快速確認 API 是否啟動。

## 2) 為什麼先做「主檔」？
你可以把系統想成一棵樹：
- organization（學校/租戶）是根
- users / locations / policies 是「所有流程必須依賴的設定與主檔」
- circulation（借還）與 reports（報表）是「在主檔上運轉的流程資料」

如果先做借還但沒有 policies / users / locations：
- 借期怎麼算？（policy）
- 借給誰？（user）
- 冊在哪裡？（location）
最後會被迫在程式碼裡寫死規則，未來改很痛。

## 3) NestJS 分層：Controller vs Service（為什麼要分）
在 `apps/api` 我採用 NestJS 的典型分層：
- **Controller**：負責 HTTP（路由、參數、回傳）
- **Service**：負責商業邏輯（查詢 DB、處理錯誤、決策）
- **Module**：把一組功能包成一個可插拔的單位

這樣做的好處：
- 你讀 Controller 就知道 API 長什麼樣
- 你測試 Service 就能驗證邏輯（未來可以加單元測試）
- 模組邊界清楚，後續拆分（或改成多服務）不會整個打掉重練

對應程式位置：
- `apps/api/src/orgs/*`
- `apps/api/src/locations/*`
- `apps/api/src/users/*`
- `apps/api/src/policies/*`

### 範例：Controller 收 request → 呼叫 Service → 回 response
（節錄自 orgs）

`apps/api/src/orgs/orgs.controller.ts`
```ts
@Controller('api/v1/orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  async create(@Body(new ZodValidationPipe(createOrgSchema)) body: any) {
    return await this.orgs.create(body);
  }
}
```
你可以把它理解成：
1. `@Controller('api/v1/orgs')`：設定路由前綴
2. `@Post()`：這個方法處理 HTTP POST
3. `@Body(...)`：取出 request body，先用 zod 驗證
4. `this.orgs.create(body)`：把驗證過的資料交給 Service 處理（查 DB）
5. return：回傳 JSON（NestJS 會幫你序列化）

## 4) DB 連線：為什麼先用 pg（SQL）而不是 ORM？
目前我用 `pg`（node-postgres）直接寫 SQL，原因是：
- 我們已經有 `db/schema.sql` 作為「資料模型真相來源」
- 直接 SQL 更能對齊你在圖資系統想要的 constraint/一致性（例如 partial unique index）
- 初期功能少，用 SQL 可最快落地；等 schema 穩定後，再導入 Prisma migrations 會更划算

> 這不是否定 ORM；而是把「何時導入 ORM」當作一個可控的時間點（擴充點）。

對應程式位置：
- `apps/api/src/db/db.service.ts`：建立連線池（Pool）、提供 `query()`、`transaction()`

### 範例：DbService（連線池 + query）
`apps/api/src/db/db.service.ts`
```ts
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Missing required env var: DATABASE_URL (請在環境變數或 repo root 的 .env / apps/api/.env 設定 DATABASE_URL)',
      );
    }
    this.pool = new Pool({ connectionString });
  }

  async query<T>(sql: string, params: unknown[] = []) {
    return await this.pool.query<T>(sql, params);
  }
}
```
關鍵概念：
- `Pool` 會重用連線（不需要每個 request 都重新連 DB）
- `query(sql, params)` 用參數化查詢（`$1/$2`）避免 SQL injection

## 5) 為什麼要有 transaction（交易）？
這輪做的是主檔 CRUD，單表操作居多；但我們先把 transaction 能力放好，因為下一輪的借還會需要：
- 新增 loan
- 更新 item status
- 寫 audit event
這些必須「要嘛全部成功、要嘛全部失敗」，否則資料會不一致（例如 loan 建了但 item 狀態沒更新）。

`DbService.transaction()` 的核心概念：
1. `BEGIN`
2. 執行多個 SQL
3. 成功 `COMMIT`
4. 任一失敗 `ROLLBACK`

### 範例：DbService.transaction()
`apps/api/src/db/db.service.ts`
```ts
async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return await this.withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
```
你可以把它想成：把多步驟 SQL 放進「同一筆交易」中，確保一致性。

## 6) 參數驗證：TypeScript 型別不等於資料真的安全
TypeScript 型別只在「編譯期」存在；HTTP request 傳進來的是不可信的 JSON。  
所以我加入 **runtime validation**：
- path 參數（UUID）：用 Nest 內建 `ParseUUIDPipe`
- body：用 `zod` + `ZodValidationPipe` 驗證

對應程式位置：
- `apps/api/src/common/zod-validation.pipe.ts`
- 各模組的 `*.schemas.ts`

這能避免：
- 傳錯欄位造成 500
- 傳不合理資料造成 DB constraint error（雖然 DB 也會擋，但錯誤訊息會不好懂）

### 範例：ZodValidationPipe
`apps/api/src/common/zod-validation.pipe.ts`
```ts
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
  }
}
```
重點：
- zod 讓你用「宣告式」方式定義欄位規則（必填、長度、格式）
- Pipe 讓驗證邏輯在 Controller 前先跑完（錯就回 400）

## 7) 錯誤處理：先把「可理解」放進回應
目前在 Service 層有針對常見 DB 錯誤做初步轉譯：
- `23505`（unique violation）→ 409 CONFLICT
- `23503`（foreign key violation）→ 404 NOT_FOUND（例如 orgId 不存在）

原因：
- DB 的錯誤碼對開發者有意義，但對使用者/前端不友善
- 我們希望 API 回應能「可預期」，前端才能做一致的錯誤處理

> 後續可以再加全域 Exception Filter，把所有錯誤統一成 `API-DRAFT.md` 的 error 格式。

## 8) CORS 與 dotenv：為什麼需要？
本機開發時 Web（3000）與 API（3001）是不同 port，瀏覽器會視為不同 origin，因此需要 CORS。
- 我們在 `apps/api/src/main.ts` 設定 `app.enableCors({ origin: true })`，讓 dev 時可以直接呼叫 API。

另外 Node.js 不會自動讀 `.env`，所以用 `dotenv`：
- API 啟動時會載入 `.env`（monorepo/workspaces 友善：先找 `apps/api/.env`，再找 repo root `.env`）
  → 讓你本機可以用 `.env` 或環境變數設定 `DATABASE_URL`、`API_PORT`

### 範例：main.ts（dotenv + CORS）
`apps/api/src/main.ts`
```ts
loadEnv();
const app = await NestFactory.create(AppModule, new FastifyAdapter());
app.enableCors({ origin: true });
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '0.0.0.0' });
```

## 9) 如何手動驗證（不用寫測試也能先確認對不對）
前置：
1. `docker compose up -d postgres redis`
2. 套用 schema：`db/schema.sql`（見 `README.md` 的 PowerShell 範例）
3. 設定 `DATABASE_URL`（可用 `.env`）
4. `npm install`
5. `npm run dev:api`

用 curl（或 Postman）測試：
- 建立 org：
  - `POST http://localhost:3001/api/v1/orgs` body：`{ "name": "XX 國小", "code": "xxes" }`
- 列出 org：
  - `GET http://localhost:3001/api/v1/orgs`
- 建立 location：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/locations`
- 建立 user：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/users`
- 建立 policy：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/circulation-policies`

## 10) 下一輪建議怎麼做（實作順序）
1. 把 `MVP-SPEC.md` 的預設政策寫成 seed（初始化資料）：建 org 後自動建立 student/teacher policies（或提供一鍵初始化端點）
2. 做 `bibliographic_records` + `item_copies`（書目/冊），因為 circulation 需要 item
3. 做 checkout/checkin（用 transaction + audit）
4. 再做 holds（預約）與 overdue/report
