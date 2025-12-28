# 0030：MARC 匯入 v1（.mrc / MARCXML / MARC-in-JSON → 表單欄位 + `marc_extras`；批次 preview/apply）

本文件記錄「進階編目」第二步：**MARC 匯入**。

需求對齊：
- 支援三種格式：ISO2709 `.mrc`、MARCXML、MARC-in-JSON
- 以「表單欄位」做為可治理真相來源（建立/更新書目仍用 `title/creators/subjects/...`）
- 未對映欄位要能保留（寫入 `bibliographic_records.marc_extras`）
- 可選擇在匯入時補齊 authority terms（姓名/主題詞）

---

## 1) Web：匯入頁面（v1：批次 preview/apply）

新增頁面：`apps/web/app/orgs/[orgId]/bibs/import-marc/page.tsx`

行為（v1）：
1) 選擇檔案（支援 `.mrc/.xml/.json`）
2) 前端解析 → 可選擇 record 並逐筆微調映射後的表單欄位
3) 按「預覽批次匯入」：
   - `POST /api/v1/orgs/:orgId/bibs/import-marc`（mode=preview）
   - 後端做去重（ISBN/035）並回傳建議動作（create/update/skip）+ warnings/errors 報表
4) 逐筆調整 decision 後按「套用（apply）」：
   - `POST /api/v1/orgs/:orgId/bibs/import-marc`（mode=apply）
   - 交易內批次寫入（bibs + marc_extras + 035 identifiers）並寫一筆 audit_events

導覽：
- org sidebar：`apps/web/app/orgs/[orgId]/layout.tsx` 增加 `MARC Import`
- bibs 頁：`apps/web/app/orgs/[orgId]/bibs/page.tsx` 增加入口

---

## 2) Web：parser 與映射

核心工具放在：`apps/web/app/lib/marc-import.ts`

### 2.1 ISO2709 `.mrc`
- 以 leader 的 record length 切割多筆 record
- 解析 directory（12 bytes entries）定位每個 field
- datafield 解析 `0x1f` 子欄位分隔符
 - v1：偵測 `leader[9] != 'a'`（可能是 MARC-8）時會提示先轉成 UTF-8（避免吞掉亂碼）

### 2.2 MARCXML
- 使用瀏覽器 `DOMParser` 解析
- 支援 namespace（MARC21 slim）與無 namespace 的 `<record>`

### 2.3 MARC-in-JSON
同時支援：
- 本專案 JSON-friendly `MarcRecord`：`{ leader, fields:[{tag,...}] }`
- 常見 MARC-in-JSON：`{ leader, fields:[{"001":"..."},{"245":{ind1,ind2,subfields:[{"a":"..."}]}}] }`

### 2.4 映射到表單欄位（v0）
`deriveBibFromMarcRecord()` 的 MVP 映射策略：
- title：`245$a`（加上 `245$b/$n/$p` 的簡化串接）
- creators：`100/110/111 $a`
- contributors：`700/710/711 $a`
- subjects：`650/651 $a`
- publisher/year：`264$b/$c`（或 `260$b/$c`）
- language：`041$a`；若沒有，嘗試 `008/35-37`
- isbn：`020$a`（抽出 10~20 碼數字/破折號）
- classification：優先 `082$a`，其次 `084$a`

`marc_extras`（v1）：
`marc_extras`（v1.1）：
- 只排除 **系統管理**欄位：`000/001/005`
  - `000` 是 leader（不是 field tag）
  - `001/005` 由後端產生（控制號/時間戳），後端也會拒絕存入 `marc_extras`
- 其餘欄位都保留進 `marc_extras`（包含 `020/041/082/084`）
  - 你要求「子欄位不丟」：例如 `020$q`、`041$b`、`082$2`、`084$2` 等都要保留
  - 後端匯出時會做 merge：核心 `$a` 仍以表單欄位為準，但會保留 extras 的其他子欄位，避免重複輸出

---

## 3) 如何驗證（手動）

1) 啟動 demo：
```bash
npm run docker:demo
```

2) 登入 staff 後進入：
- `http://localhost:3000/orgs/<orgId>/bibs/import-marc`

3) 上傳任一檔案（你也可以用前一輪的匯出下載）：
- 在書目詳頁 `MARC 21` 區塊下載 `bib-<bibId>.mrc` / `bib-<bibId>.xml` / `bib-<bibId>.marc.json`
- 再到匯入頁上傳，確認能建立新書目並保留 `marc_extras`

## 3.1) 如何驗證（自動；roundtrip）

本專案新增一支 smoke-level QA 腳本，驗證：
- 245/264/650/700 merge 不丟子欄位
- ISO2709 / MARCXML / JSON roundtrip 不丟欄位

執行：
```bash
npm run qa:marc
```

---

## 4) 下一步（更完整的 cataloging）

- Authority terms：把 creators/subjects UI 從 textarea 升級 chips（更像真正編目工作流）
- MARC 編輯器：已從 JSON textarea 進化到可視化編輯（先聚焦 `marc_extras`）；下一步可補「常用欄位模板/字典」與更強的 per-tag 驗證
- server-side import（可選）：若要匯入上千筆大檔，可做 multipart upload + server-side parse
