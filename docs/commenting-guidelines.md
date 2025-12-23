# 註解與教學文件規範（本專案採「可學習」模式）

你希望程式碼本身能當教材，因此本專案採用「高密度註解 + 文件搭配程式碼片段」的寫法。這份文件說明我們怎麼寫註解、怎麼寫教學文件，以及哪些檔案無法用註解解釋（要改用文件）。

## 1) 註解要達到的目標
- **讓第一次接觸 TypeScript/NestJS/Next.js 的人看得懂**：每個檔案在做什麼、為什麼要這樣設計。
- **把「為什麼」留在程式旁邊**：不只描述「做了什麼」，也要說明取捨與原理。
- **避免文件與程式脫節**：當行為改了、註解也要一起改。

## 2) 註解密度與形式（實務準則）
> 你要求「基本上每行或每個小段落」要能理解，所以我們用「小段落註解」為主，必要時補 inline 註解。

### 2.1 每個檔案（File-level）
每個程式檔案開頭都要有一段註解，回答：
- 這檔案的角色是什麼？（例如：API 入口 / Controller / Service / Schema）
- 它與哪些模組互動？（例如：Controller → Service → DbService）
- 有哪些重要概念？（例如：transaction、RBAC、multi-tenant）

### 2.2 每個主要區塊（Block-level）
對每個主要區塊加註解，例如：
- 每個 endpoint（路由）要說明用途、輸入、輸出與錯誤
- 每個 SQL 查詢要說明：對應哪個表、為什麼要這個 index/constraint
- 每個狀態/規則判斷要說明：對應哪個業務情境

### 2.3 每個關鍵行（Line-level）
只在「容易誤解或有坑」的行加 inline 註解，例如：
- Postgres error code（23505/23503）
- partial unique index 的語意（「同冊同時只能有一筆未歸還借閱」）
- CORS/host/port 的選擇

## 3) 什麼檔案不能寫註解？（以及替代做法）
- `package.json`：JSON 規格不允許註解  
  → 改用 `docs/how-it-works.md` 或 `docs/implementation/*.md` 說明 scripts/workspaces。
- `tsconfig.json`：JSON 不允許註解  
  → 改用 `docs/typescript-nextjs-nestjs-primer.md` 說明 TS 編譯設定。

> YAML（例如 `docker-compose.yml`）與 SQL 可以寫註解；Markdown 當然可以。

## 4) 教學文件怎麼寫（要搭配程式碼片段）
每次實作一個功能或一輪改動，請新增或更新：
- `docs/implementation/000x-*.md`：說明「做了什麼、為什麼、原理、如何驗證」

文件中至少要包含：
- 對照到 `USER-STORIES.md` 的哪幾條（驗收條件）
- 對照到 `API-DRAFT.md` 的哪些端點（request/response）
- 至少 2–5 段「實際程式碼片段」＋逐段落說明（Controller/Service/DB/Validation）

## 5) 註解語言與風格
- 一律以 **繁體中文**為主，必要時保留英文技術名詞（transaction、controller、DI）。
- 以「能推導出行為」為準：不要寫錯、不要寫過時的描述。
- 盡量避免「只是重述程式碼」的註解（例如 `x++ // x 加一`）；重點放在原因與語意。

