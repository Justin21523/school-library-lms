/**
 * Cursor pagination helpers（Keyset pagination）
 *
 * 本專案的「大量資料」驗證（scale seed）需要分頁，否則：
 * - 前端一次拉 5k/50k 筆會很慢（也容易把瀏覽器撐爆）
 * - 後端一次回傳過大 JSON 也浪費網路與記憶體
 *
 * 但我們不想用 offset pagination（LIMIT/OFFSET），因為：
 * - offset 會隨資料量變大而變慢（越往後越慢）
 * - 若資料在翻頁過程中新增/刪除，offset 可能造成「跳漏/重複」
 *
 * 因此採用 keyset/cursor pagination：
 * - 用「排序鍵 + id」當游標
 * - 下一頁用 WHERE (sort, id) < (...)（或 >，取決於排序方向）取得連續區間
 *
 * Cursor 格式（v1）：
 * - Base64URL(JSON)
 * - JSON shape：{ "sort": "<ISO timestamp string>", "id": "<uuid>" }
 *
 * 注意：
 * - sort 的語意由各 endpoint 決定（例如 users 用 created_at，loans 用 checked_out_at）
 * - 這個 helper 只負責 encode/decode 與基本驗證（不含 DB 查詢）
 */

export type CursorV1 = {
  sort: string;
  id: string;
};

/**
 * CursorTextV1（文字排序用的 keyset cursor）
 *
 * 為什麼要第二種 cursor？
 * - CursorV1 目前把 sort 限制成「datetime」（用於 created_at/due_at 等時間序）
 * - 但 thesaurus/authority 常見的 UX 是「依 preferred_label 字母順序」瀏覽
 *   → 這時 sort 就是一般字串，不是 datetime
 *
 * 這裡刻意分成兩套（而不是放寬 CursorV1）：
 * - 避免既有端點意外接受非 datetime sort（造成 cursor 不可重現/排序錯誤）
 * - 也讓每個端點清楚表達「我的排序鍵是時間還是文字」
 */
export type CursorTextV1 = {
  sort: string;
  id: string;
};

/**
 * CursorPage（API 回傳的分頁 envelope）
 *
 * 我們刻意用 `{ items, next_cursor }` 而不是直接回 array，原因是：
 * - array 無法表示「還有沒有下一頁」
 * - next_cursor 是「可重現」的指標：前端只要把它帶回來就能接續查下一段資料
 *
 * 命名用 snake_case（next_cursor）是為了和目前 API 的 snake_case row 欄位一致。
 */
export type CursorPage<T> = {
  items: T[];
  next_cursor: string | null;
};

// RFC 4122 UUID（最常見的格式；與 zod uuid() 的期望一致）
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * normalizeSortToIso
 *
 * DB driver（pg）對 timestamptz 的回傳型別可能是：
 * - string（例如 "2025-12-26T00:00:00.000Z"）
 * - Date（取決於型別 parser 設定；目前本專案未覆寫 parser）
 *
 * 為了讓 cursor 在不同環境下仍可重現，我們把 sort 統一正規化成 ISO string。
 */
export function normalizeSortToIso(value: unknown): string {
  const d =
    value instanceof Date
      ? value
      : // 若 value 是 string（或其他），先轉成 string 交給 Date parser。
        new Date(String(value));

  if (Number.isNaN(d.getTime())) {
    throw new Error('cursor sort value is not a valid datetime');
  }

  return d.toISOString();
}

export function encodeCursorV1(cursor: CursorV1): string {
  // base64url：避免 +/ 在 URL query string 裡需要額外 encode
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursorV1(value: string): CursorV1 {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('cursor is empty');

  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
  } catch {
    throw new Error('cursor is not valid base64url');
  }

  let obj: any;
  try {
    obj = JSON.parse(decoded);
  } catch {
    throw new Error('cursor is not valid JSON');
  }

  const sort = typeof obj?.sort === 'string' ? obj.sort.trim() : '';
  const id = typeof obj?.id === 'string' ? obj.id.trim() : '';

  if (!sort) throw new Error('cursor.sort is required');
  if (!id) throw new Error('cursor.id is required');
  if (!UUID_RE.test(id)) throw new Error('cursor.id must be a UUID');

  const d = new Date(sort);
  if (Number.isNaN(d.getTime())) throw new Error('cursor.sort must be a valid datetime string');

  // 正規化：用 ISO string（避免不同格式造成「同值不同字串」）
  return { sort: d.toISOString(), id };
}

export function encodeCursorTextV1(cursor: CursorTextV1): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursorTextV1(value: string): CursorTextV1 {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('cursor is empty');

  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
  } catch {
    throw new Error('cursor is not valid base64url');
  }

  let obj: any;
  try {
    obj = JSON.parse(decoded);
  } catch {
    throw new Error('cursor is not valid JSON');
  }

  const sort = typeof obj?.sort === 'string' ? obj.sort.trim() : '';
  const id = typeof obj?.id === 'string' ? obj.id.trim() : '';

  if (!sort) throw new Error('cursor.sort is required');
  if (!id) throw new Error('cursor.id is required');
  if (!UUID_RE.test(id)) throw new Error('cursor.id must be a UUID');

  // 文字 cursor 不做「datetime 正規化」，但仍做基本長度限制，避免把巨量字串塞進 cursor。
  if (sort.length > 500) throw new Error('cursor.sort is too long');

  return { sort, id };
}
