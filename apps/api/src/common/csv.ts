/**
 * CSV Parser（無外部套件）
 *
 * 為什麼不用第三方套件？
 * - 這個 repo 目前在沙盒環境下常常需要避免「額外安裝依賴」與「網路存取」
 * - MVP 需求主要是「學校名冊匯入」：欄位少、資料量中等（幾百～幾千列）
 *
 * 目標：
 * - 支援 RFC 4180 常見規則：逗號分隔、雙引號包欄位、"" 代表字元 "
 * - 支援 CRLF / LF
 * - 支援「欄位中包含逗號/換行」的情境（只要有正確加引號）
 *
 * 注意：
 * - 這裡只做「語法層」解析（轉成 row/field 陣列）
 * - 欄位名稱映射、型別轉換、業務驗證（例如 role/status）應該在 domain service 做
 */

export type CsvRecord = string[];

export type ParseCsvResult = {
  // records：包含 header 在內的所有列（第一列通常是 header）
  records: CsvRecord[];
};

/**
 * 去除 UTF-8 BOM（Byte Order Mark）
 *
 * Excel 有時會在 UTF-8 CSV 開頭加 BOM（\uFEFF），若不移除會讓第一個 header 變成「\uFEFFexternal_id」
 * → 造成 header mapping 失敗。
 */
function stripUtf8Bom(text: string) {
  if (!text) return text;
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * parseCsv
 *
 * 輸入：CSV 文字
 * 輸出：records（string[][]）
 *
 * 解析策略：單 pass 的 state machine
 * - inQuotes=false：遇到 , → 欄位結束；遇到換行 → 列結束
 * - inQuotes=true：逗號/換行都視為一般字元；遇到 "" → 代表一個 "
 */
export function parseCsv(text: string): ParseCsvResult {
  const input = stripUtf8Bom(text);

  const records: CsvRecord[] = [];

  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  function pushField() {
    record.push(field);
    field = '';
  }

  function pushRecord() {
    pushField();
    records.push(record);
    record = [];
  }

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // ""（雙雙引號）→ 代表字元 "
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i += 1; // consume the escaped quote
          continue;
        }

        // 單一 " → 結束 quoted field
        inQuotes = false;
        continue;
      }

      // quoted field 裡：任何字元都原樣加入（含逗號/換行）
      field += ch;
      continue;
    }

    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      pushField();
      continue;
    }

    // 換行：支援 CRLF 與 LF
    if (ch === '\n') {
      pushRecord();
      continue;
    }
    if (ch === '\r') {
      // CRLF：吃掉後面的 \n
      if (input[i + 1] === '\n') i += 1;
      pushRecord();
      continue;
    }

    field += ch;
  }

  // 檔案結尾：把最後一個 record 收尾
  // - 若整份 CSV 是空字串，records 仍會是 []
  // - 若結尾剛好是換行，最後會多推一個空 record（下方會清掉）
  if (input.length > 0) {
    pushRecord();
  }

  // 去掉尾端的「完全空白列」（常見於 CSV 結尾多一個換行）
  while (records.length > 0) {
    const last = records[records.length - 1]!;
    const isAllEmpty = last.every((cell) => cell.trim() === '');
    if (!isAllEmpty) break;
    records.pop();
  }

  return { records };
}

