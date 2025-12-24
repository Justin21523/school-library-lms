/**
 * Web → API Client（fetch wrapper）
 *
 * 目標：
 * - 把「呼叫 API 的細節」集中在這裡（baseUrl、錯誤格式、JSON parse）
 * - 讓 page/component 只關心「要呼叫哪個端點」與「如何顯示資料」
 *
 * 設計原則（對齊目前 API 的實作）：
 * - API 路由以 `/api/v1/...` 為前綴
 * - 錯誤回應多為 `{ error: { code, message, details? } }`
 * - MVP 階段沒有 auth，因此 circulation 需要在 body 傳 `actor_user_id`
 */

// 這些型別是「Web 端看到的 API 回傳形狀」；
// 目前 API 直接回傳 SQL row，因此欄位是 snake_case（例如 created_at）。
export type Organization = {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  area: string | null;
  shelf_code: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
  org_unit: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type CirculationPolicy = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  audience_role: 'student' | 'teacher';
  loan_days: number;
  max_loans: number;
  max_renewals: number;
  max_holds: number;
  hold_pickup_days: number;
  created_at: string;
  updated_at: string;
};

export type BibliographicRecord = {
  id: string;
  organization_id: string;
  title: string;
  creators: string[] | null;
  contributors: string[] | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  isbn: string | null;
  classification: string | null;
  created_at: string;
  updated_at: string;
};

export type BibliographicRecordWithCounts = BibliographicRecord & {
  total_items: number;
  available_items: number;
};

export type ItemStatus =
  | 'available'
  | 'checked_out'
  | 'on_hold'
  | 'lost'
  | 'withdrawn'
  | 'repair';

export type ItemCopy = {
  id: string;
  organization_id: string;
  bibliographic_id: string;
  barcode: string;
  call_number: string;
  location_id: string;
  status: ItemStatus;
  acquired_at: string | null;
  last_inventory_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckoutResult = {
  loan_id: string;
  item_id: string;
  user_id: string;
  due_at: string;
};

export type CheckinResult = {
  loan_id: string;
  item_id: string;
  item_status: ItemStatus;
  hold_id: string | null;
  ready_until: string | null;
};

export type LoanStatus = 'open' | 'closed';

// loans list 會回「loan + borrower + item + bib title」，方便 UI 顯示。
export type LoanWithDetails = {
  // loan
  id: string;
  organization_id: string;
  item_id: string;
  user_id: string;
  checked_out_at: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
  status: LoanStatus;
  is_overdue: boolean;

  // borrower
  user_external_id: string;
  user_name: string;
  user_role: User['role'];
  user_status: User['status'];

  // item
  item_barcode: string;
  item_status: ItemStatus;
  item_call_number: string;
  item_location_id: string;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;
};

export type RenewResult = {
  loan_id: string;
  item_id: string;
  user_id: string;
  due_at: string;
  renewed_count: number;
};

// holds（預約/保留）
// - status 與 db/schema.sql 的 hold_status enum 對齊
export type HoldStatus = 'queued' | 'ready' | 'cancelled' | 'fulfilled' | 'expired';

// list/create/cancel 會回傳「hold + borrower + bib title + pickup location + assigned item」的組合資料
// - 這是 API 端直接 join 出來的 row（snake_case）
export type HoldWithDetails = {
  // hold
  id: string;
  organization_id: string;
  bibliographic_id: string;
  user_id: string;
  pickup_location_id: string;
  placed_at: string;
  status: HoldStatus;
  assigned_item_id: string | null;
  ready_at: string | null;
  ready_until: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;

  // borrower
  user_external_id: string;
  user_name: string;
  user_role: User['role'];

  // bib
  bibliographic_title: string;

  // pickup location
  pickup_location_code: string;
  pickup_location_name: string;

  // assigned item（可能為 NULL）
  assigned_item_barcode: string | null;
  assigned_item_status: ItemStatus | null;
};

// fulfill 的回傳是「動作結果」：成功建立 loan 後，回傳 loan 與 item 的關鍵欄位
export type FulfillHoldResult = {
  hold_id: string;
  loan_id: string;
  item_id: string;
  item_barcode: string;
  user_id: string;
  due_at: string;
};

// API 錯誤格式（MVP 版本：以 error 物件包起來）
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * ApiError：把 HTTP status 與 API 的 error body 綁在一起，方便 UI 顯示。
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * API base URL 的來源：
 * - 優先使用 `NEXT_PUBLIC_API_BASE_URL`（讓你在不同環境可切換 API 位址）
 * - 若未設定，開發環境預設 `http://localhost:3001`
 *
 * 注意：NEXT_PUBLIC 代表「會被打包進前端」；因此不要放 secret。
 */
function getApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  return 'http://localhost:3001';
}

/**
 * 把 query object 轉成 URLSearchParams（只保留有值的欄位）
 *
 * 這個小工具能避免：
 * - 一堆 `if (x) url += ...` 的樣板碼
 * - 把 undefined/null 拼進 query string（變成 "undefined"）
 */
type QueryValue = string | number | boolean | undefined | null;

function toSearchParams(query: Record<string, QueryValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    // QueryParam 一律以字串送出：
    // - string：trim 後送出
    // - number/boolean：轉成字串後送出（例如 limit=200, overdue=true）
    const trimmed = (typeof value === 'string' ? value : String(value)).trim();
    if (!trimmed) continue;
    params.set(key, trimmed);
  }

  return params;
}

/**
 * 低階 request：負責
 * - 組 URL
 * - 呼叫 fetch
 * - JSON parse（成功/失敗都盡量 parse）
 * - 不 OK 時丟出 ApiError
 */
async function requestJson<T>(
  path: string,
  options: { method: string; query?: Record<string, QueryValue>; body?: unknown },
): Promise<T> {
  // 1) 組出完整 URL（base + path + query）
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (options.query) {
    const params = toSearchParams(options.query);
    const queryString = params.toString();
    if (queryString) url.search = queryString;
  }

  // 2) 組 fetch init（MVP：只處理 JSON）
  const init: RequestInit = {
    method: options.method,
    headers: { 'content-type': 'application/json' },
  };

  // body 只有在需要時才帶（GET/HEAD 不應帶 body）。
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  // 3) 發出 request
  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    // fetch 失敗通常是「網路/連線」問題（例如 API 沒開）
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      null,
    );
  }

  // 4) 盡量 parse JSON（即使 response.ok=false，也可能有 error body）
  const text = await response.text();

  // 空字串代表 API 沒回 body；這裡用 null 表示「沒有 JSON」。
  const json = text ? (JSON.parse(text) as unknown) : null;

  // 5) 如果 HTTP status 非 2xx，統一丟出 ApiError 讓 UI 捕捉
  if (!response.ok) {
    const body = isApiErrorBody(json) ? json : null;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  // 6) 成功：把 json 當成 T 回傳
  return json as T;
}

/**
 * runtime type guard：判斷一個 unknown 是否符合 ApiErrorBody。
 * - 這讓我們在顯示錯誤時更安全，不會因為 shape 不符就 crash。
 */
function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const error = record['error'];
  if (!error || typeof error !== 'object') return false;
  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord['code'] === 'string' && typeof errorRecord['message'] === 'string';
}

/**
 * 對外的 domain functions：讓頁面用「語意化函式」呼叫 API。
 * 這比在每個 page 裡硬寫 URL 更容易維護與重構。
 */

export async function listOrganizations() {
  return await requestJson<Organization[]>('/api/v1/orgs', { method: 'GET' });
}

export async function createOrganization(input: { name: string; code?: string }) {
  return await requestJson<Organization>('/api/v1/orgs', {
    method: 'POST',
    body: input,
  });
}

export async function getOrganization(orgId: string) {
  return await requestJson<Organization>(`/api/v1/orgs/${orgId}`, { method: 'GET' });
}

export async function listLocations(orgId: string) {
  return await requestJson<Location[]>(`/api/v1/orgs/${orgId}/locations`, { method: 'GET' });
}

export async function createLocation(
  orgId: string,
  input: { code: string; name: string; area?: string; shelf_code?: string },
) {
  return await requestJson<Location>(`/api/v1/orgs/${orgId}/locations`, {
    method: 'POST',
    body: input,
  });
}

export async function listUsers(orgId: string, query?: string) {
  return await requestJson<User[]>(`/api/v1/orgs/${orgId}/users`, {
    method: 'GET',
    query: { query },
  });
}

export async function createUser(
  orgId: string,
  input: { external_id: string; name: string; role: User['role']; org_unit?: string },
) {
  return await requestJson<User>(`/api/v1/orgs/${orgId}/users`, {
    method: 'POST',
    body: input,
  });
}

export async function listPolicies(orgId: string) {
  return await requestJson<CirculationPolicy[]>(
    `/api/v1/orgs/${orgId}/circulation-policies`,
    { method: 'GET' },
  );
}

export async function createPolicy(
  orgId: string,
  input: {
    code: string;
    name: string;
    audience_role: CirculationPolicy['audience_role'];
    loan_days: number;
    max_loans: number;
    max_renewals: number;
    max_holds: number;
    hold_pickup_days: number;
  },
) {
  return await requestJson<CirculationPolicy>(
    `/api/v1/orgs/${orgId}/circulation-policies`,
    { method: 'POST', body: input },
  );
}

export async function listBibs(
  orgId: string,
  filters: { query?: string; isbn?: string; classification?: string },
) {
  return await requestJson<BibliographicRecordWithCounts[]>(`/api/v1/orgs/${orgId}/bibs`, {
    method: 'GET',
    query: filters,
  });
}

export async function createBib(
  orgId: string,
  input: {
    title: string;
    creators?: string[];
    contributors?: string[];
    publisher?: string;
    published_year?: number;
    language?: string;
    subjects?: string[];
    isbn?: string;
    classification?: string;
  },
) {
  return await requestJson<BibliographicRecord>(`/api/v1/orgs/${orgId}/bibs`, {
    method: 'POST',
    body: input,
  });
}

export async function getBib(orgId: string, bibId: string) {
  return await requestJson<BibliographicRecordWithCounts>(
    `/api/v1/orgs/${orgId}/bibs/${bibId}`,
    { method: 'GET' },
  );
}

export async function updateBib(
  orgId: string,
  bibId: string,
  input: {
    title?: string;
    creators?: string[] | null;
    contributors?: string[] | null;
    publisher?: string | null;
    published_year?: number | null;
    language?: string | null;
    subjects?: string[] | null;
    isbn?: string | null;
    classification?: string | null;
  },
) {
  return await requestJson<BibliographicRecord>(
    `/api/v1/orgs/${orgId}/bibs/${bibId}`,
    { method: 'PATCH', body: input },
  );
}

export async function listItems(
  orgId: string,
  filters: {
    barcode?: string;
    status?: ItemStatus | string;
    location_id?: string;
    bibliographic_id?: string;
  },
) {
  return await requestJson<ItemCopy[]>(`/api/v1/orgs/${orgId}/items`, {
    method: 'GET',
    query: filters,
  });
}

export async function createItem(
  orgId: string,
  bibId: string,
  input: {
    barcode: string;
    call_number: string;
    location_id: string;
    status?: ItemStatus;
    acquired_at?: string;
    last_inventory_at?: string;
    notes?: string;
  },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/bibs/${bibId}/items`, {
    method: 'POST',
    body: input,
  });
}

export async function getItem(orgId: string, itemId: string) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/items/${itemId}`, {
    method: 'GET',
  });
}

export async function updateItem(
  orgId: string,
  itemId: string,
  input: {
    barcode?: string;
    call_number?: string;
    location_id?: string;
    status?: ItemStatus;
    acquired_at?: string | null;
    last_inventory_at?: string | null;
    notes?: string | null;
  },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/items/${itemId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function checkout(
  orgId: string,
  input: { user_external_id: string; item_barcode: string; actor_user_id: string },
) {
  return await requestJson<CheckoutResult>(`/api/v1/orgs/${orgId}/circulation/checkout`, {
    method: 'POST',
    body: input,
  });
}

export async function checkin(
  orgId: string,
  input: { item_barcode: string; actor_user_id: string },
) {
  return await requestJson<CheckinResult>(`/api/v1/orgs/${orgId}/circulation/checkin`, {
    method: 'POST',
    body: input,
  });
}

export async function listLoans(
  orgId: string,
  filters: {
    status?: 'open' | 'closed' | 'all';
    user_external_id?: string;
    item_barcode?: string;
    limit?: number;
  },
) {
  return await requestJson<LoanWithDetails[]>(`/api/v1/orgs/${orgId}/loans`, {
    method: 'GET',
    query: filters,
  });
}

export async function renewLoan(
  orgId: string,
  input: { loan_id: string; actor_user_id: string },
) {
  return await requestJson<RenewResult>(`/api/v1/orgs/${orgId}/circulation/renew`, {
    method: 'POST',
    body: input,
  });
}

/**
 * Holds（預約/保留）
 *
 * 這組 API 同時支援：
 * - Web Console（館員）：會傳 actor_user_id（admin/librarian），便於 audit
 * - OPAC 自助：不傳 actor_user_id（MVP 無登入，後端視為 borrower 本人）
 */

export async function listHolds(
  orgId: string,
  filters: {
    status?: HoldStatus | 'all';
    user_external_id?: string;
    item_barcode?: string;
    bibliographic_id?: string;
    pickup_location_id?: string;
    limit?: number;
  },
) {
  return await requestJson<HoldWithDetails[]>(`/api/v1/orgs/${orgId}/holds`, {
    method: 'GET',
    query: filters,
  });
}

export async function createHold(
  orgId: string,
  input: {
    bibliographic_id: string;
    user_external_id: string;
    pickup_location_id: string;
    actor_user_id?: string;
  },
) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/holds`, {
    method: 'POST',
    body: input,
  });
}

export async function cancelHold(
  orgId: string,
  holdId: string,
  input: { actor_user_id?: string },
) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/holds/${holdId}/cancel`, {
    method: 'POST',
    body: input,
  });
}

export async function fulfillHold(
  orgId: string,
  holdId: string,
  input: { actor_user_id: string },
) {
  return await requestJson<FulfillHoldResult>(`/api/v1/orgs/${orgId}/holds/${holdId}/fulfill`, {
    method: 'POST',
    body: input,
  });
}
