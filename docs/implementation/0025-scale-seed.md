# 0025：Scale seed（大量假資料）用於 UI 完整性驗證

本文件說明本 repo 的「大量假資料（Scale seed）」工具：`scripts/seed-scale.py`。

## 目標與定位
- 目標是「一個 org、量級大、全繁體中文」的可重現假資料，用來把 Web Console / OPAC 的列表、搜尋、報表、盤點等頁面跑滿。
- 這不是 production migration，也不是資料科學用的真實資料產生器；它是 UI/流程驗證的工程工具。

## 使用方式（Docker）
1) 啟動整套服務（DB + API + Web）：
```bash
npm run docker:up
```

2) 匯入大量假資料（會依 org_code 刪掉整個 org 再重建）：
```bash
npm run docker:seed:scale
```

一鍵（up + scale seed）：
```bash
npm run docker:scale
```

## 重要環境變數（.env / .env.example）
Scale seed 的 env 都以 `SCALE_*` 命名（見 `.env.example`）：
- `SCALE_ORG_CODE`：預設 `demo-lms-scale`（同 org_code 可重複重建）
- `SCALE_ORG_NAME`：預設 `示範國小（大型資料集）`
- `SCALE_SEED`：預設 `42`（固定即可重現）
- `SCALE_PASSWORD`：預設 `demo1234`（只給少數帳號建立 credentials）
- `SCALE_TEXT_PROVIDER`：預設 `rules`（不靠模型；hf 介面保留但未內建依賴）

量級（可依你的機器調整）：`SCALE_STUDENTS / SCALE_TEACHERS / SCALE_BIBS / SCALE_OPEN_LOANS ...`

## 會產生哪些資料（對齊 schema.sql）
`scripts/seed-scale.py` 會用固定 random seed 產生並匯入：
- `organizations`（1 org）
- `locations`
- `users` + 少數 `user_credentials`（提供可登入帳號）
- `bibliographic_records` / `item_copies`
- `circulation_policies` / `loans` / `holds`
- `inventory_sessions` / `inventory_scans`
- `audit_events`

匯入採用 Postgres `COPY`（psql `\\copy`）而不是逐筆 `INSERT`，速度會快很多。

## 登入帳號（預設）
共用密碼：`demo1234`
- Staff：admin `A0001` / librarian `L0001`
- OPAC：teacher `T0001` / student `S1130123`

其他使用者只會出現在列表/搜尋/報表中，預設不建立 credentials（避免不必要的密碼資料量）。

## 安全性與可重複性
- 這是 demo/測試資料，請勿指向正式環境。
- 匯入前會先執行：`DELETE FROM organizations WHERE code = '<org_code>'`（透過 FK `ON DELETE CASCADE` 連帶清空該 org 的所有資料），確保可重複重建。
- 所有主鍵 UUID 以 `uuid5` 由固定 seed 產生，確保資料可重現。

## 未來擴充方向（可選）
- Hugging Face：只負責讓「文字欄位更像真的」（書名/作者/主題詞），仍必須保證不含真實個資且可重現；需明確選模型與授權策略，且會引入網路/快取/依賴管理。
- UI 完整性檢查：當資料量穩定後，可加入 Playwright 做 routes 巡覽 + 截圖/關鍵字檢查（比人工點選更可靠）。

