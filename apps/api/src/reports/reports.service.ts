/**
 * ReportsService
 *
 * 報表（reports）的核心目標是：
 * - 把「館員每天會做的查詢」做成可重複、可匯出的結果（JSON + CSV）
 * - 盡量在 DB 用「推導」而不是寫死狀態（例如逾期用 due_at < as_of 推導）
 *
 * 目前已落地的報表：
 * - 逾期清單（Overdue List）：/reports/overdue
 * - 取書架清單（Ready Holds）：/reports/ready-holds
 * - 熱門書（Top Circulation）：/reports/top-circulation
 * - 借閱量彙總（Circulation Summary）：/reports/circulation-summary
 *
 * Overdue List 的定義（MVP）：
 * - loans.returned_at IS NULL（仍未歸還）
 * - loans.due_at < as_of（到期日早於基準時間）
 *
 * 重要取捨：
 * - 我們要求 actor_user_id（admin/librarian）才能查詢/匯出
 * - CSV 會加上 UTF-8 BOM（\ufeff），讓 Excel 在中文環境較容易正確顯示
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import type {
  CirculationSummaryReportQuery,
  OverdueReportQuery,
  ReadyHoldsReportQuery,
  TopCirculationReportQuery,
} from './reports.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

// 報表屬於館員用途：只允許 admin/librarian。
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type ActorRow = { id: string; role: UserRole; status: UserStatus };

/**
 * OverdueReportRow（回傳給前端顯示/匯出）
 *
 * 注意：欄位採 snake_case（對齊目前 API：直接回傳 SQL row）
 */
export type OverdueReportRow = {
  // loan
  loan_id: string;
  checked_out_at: string;
  due_at: string;
  days_overdue: number;

  // borrower
  user_id: string;
  user_external_id: string;
  user_name: string;
  user_role: UserRole;
  user_org_unit: string | null;

  // item
  item_id: string;
  item_barcode: string;
  item_call_number: string;
  item_status: ItemStatus;
  item_location_id: string;
  item_location_code: string;
  item_location_name: string;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;
};

/**
 * TopCirculationRow（US-050 熱門書）
 *
 * 定義：在某段期間內，依「借出次數（loans count）」排序的書目排行
 *
 * 注意：
 * - 我們以 loans（借出交易）作為統計依據，代表「被借出」的次數
 * - 不看 returned_at（不論是否歸還，只要在期間內借出都算一次）
 */
export type TopCirculationRow = {
  bibliographic_id: string;
  bibliographic_title: string;
  loan_count: number;
  unique_borrowers: number;
};

/**
 * CirculationSummaryRow（US-050 借閱量彙總）
 *
 * 定義：在某段期間內，依 group_by（日/週/月）彙總「借出筆數」
 */
export type CirculationSummaryRow = {
  bucket_start: string;
  loan_count: number;
};

/**
 * ReadyHoldsReportRow（取書架清單）
 *
 * 這份清單的核心是「holds.status=ready」：
 * - 每筆代表「某一本書（某一冊）目前正在取書架等人取」
 * - 需要包含：讀者、書名、冊條碼、取書期限（ready_until）
 *
 * 注意：
 * - 我們不另外存「是否過期」狀態，而是用 ready_until < as_of 推導（與 overdue 報表一致）
 * - 若資料不一致（例如 ready hold 沒 assigned item），我們仍會回傳，但 item 欄位會是 null
 */
export type ReadyHoldsReportRow = {
  // hold
  hold_id: string;
  ready_at: string | null;
  ready_until: string | null;

  // derived（用 as_of 推導）
  is_expired: boolean;
  days_until_expire: number | null;

  // borrower
  user_id: string;
  user_external_id: string;
  user_name: string;
  user_role: UserRole;
  user_org_unit: string | null;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;

  // pickup location（取書地點：hold.pickup_location_id）
  pickup_location_id: string;
  pickup_location_code: string;
  pickup_location_name: string;

  // assigned item（可能為 NULL；例如資料不一致或歷史資料）
  assigned_item_id: string | null;
  assigned_item_barcode: string | null;
  assigned_item_call_number: string | null;
  assigned_item_status: ItemStatus | null;
  assigned_item_location_code: string | null;
  assigned_item_location_name: string | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  /**
   * listOverdue：查詢逾期清單（JSON 用）
   *
   * - 這是一個「讀取型」查詢：不需要 transaction
   * - 但仍需驗證 actor（避免敏感資料外洩）
   */
  async listOverdue(orgId: string, query: OverdueReportQuery): Promise<OverdueReportRow[]> {
    // 1) 驗證 actor（館員/管理者）
    await this.db.transaction(async (client) => {
      // 用 transaction 的理由：
      // - 這裡主要是「重用 requireStaffActor 的查詢邏輯」
      // - 讀取也可不開 transaction；但這樣寫能讓未來若要寫 audit 事件更容易擴充
      await this.requireStaffActor(client, orgId, query.actor_user_id);
    });

    // 2) as_of：未提供就用「現在」
    // - 這裡用 API server 的時間作為基準，確保一次請求內比較一致
    // - 若未來需要更嚴謹，可改成「先 SELECT now()」取得 DB 時間
    const asOf = query.as_of?.trim() ? query.as_of.trim() : new Date().toISOString();

    // 3) limit：未提供時給一個合理預設（避免一次撈爆）
    const limit = query.limit ?? 500;

    const whereClauses: string[] = [
      'l.organization_id = $1',
      'l.returned_at IS NULL',
      'l.due_at < $2::timestamptz',
    ];

    const params: unknown[] = [orgId, asOf];

    if (query.org_unit) {
      params.push(query.org_unit);
      whereClauses.push(`u.org_unit = $${params.length}`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    try {
      const result = await this.db.query<OverdueReportRow>(
        `
        SELECT
          -- loan
          l.id AS loan_id,
          l.checked_out_at,
          l.due_at,
          -- days_overdue：用 as_of - due_at 推導（整天數）
          FLOOR(EXTRACT(EPOCH FROM ($2::timestamptz - l.due_at)) / 86400)::int AS days_overdue,

          -- borrower
          u.id AS user_id,
          u.external_id AS user_external_id,
          u.name AS user_name,
          u.role AS user_role,
          u.org_unit AS user_org_unit,

          -- item
          i.id AS item_id,
          i.barcode AS item_barcode,
          i.call_number AS item_call_number,
          i.status AS item_status,
          i.location_id AS item_location_id,
          loc.code AS item_location_code,
          loc.name AS item_location_name,

          -- bibliographic
          b.id AS bibliographic_id,
          b.title AS bibliographic_title
        FROM loans l
        JOIN users u
          ON u.id = l.user_id
         AND u.organization_id = l.organization_id
        JOIN item_copies i
          ON i.id = l.item_id
         AND i.organization_id = l.organization_id
        JOIN bibliographic_records b
          ON b.id = i.bibliographic_id
         AND b.organization_id = l.organization_id
        JOIN locations loc
          ON loc.id = i.location_id
         AND loc.organization_id = l.organization_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY l.due_at ASC
        LIMIT ${limitParam}
        `,
        params,
      );

      return result.rows;
    } catch (error: any) {
      // 22P02 = invalid_text_representation：timestamptz/uuid 轉型失敗（例如 as_of 格式錯）
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  /**
   * listReadyHolds：取書架清單（JSON 用）
   *
   * 定義（MVP）：
   * - holds.status = 'ready'
   *
   * 為什麼用報表而不是直接用 /holds?status=ready？
   * - /holds 是「工作台」：偏向「操作」（cancel/fulfill），會混入其他狀態/欄位
   * - ready-holds report 是「現場每日清單」：偏向「呈現/匯出/列印」
   * - 報表可以在 SQL 端做更適合輸出的欄位（例如 is_expired、days_until_expire）
   */
  async listReadyHolds(orgId: string, query: ReadyHoldsReportQuery): Promise<ReadyHoldsReportRow[]> {
    // 1) 驗證 actor（館員/管理者）
    await this.db.transaction(async (client) => {
      await this.requireStaffActor(client, orgId, query.actor_user_id);
    });

    // 2) as_of：未提供就用「現在」
    // - 這裡用 API server 的時間作為基準（對齊 overdue 報表的做法）
    // - 若未來要更嚴謹，可改成「先 SELECT now()」取得 DB 時間
    const asOf = query.as_of?.trim() ? query.as_of.trim() : new Date().toISOString();

    // 3) limit：預設 200（取書架清單通常不需要一次撈到 5000，但仍允許調整）
    const limit = query.limit ?? 200;

    const whereClauses: string[] = ['h.organization_id = $1', `h.status = 'ready'`];
    const params: unknown[] = [orgId];

    // 我們把 as_of 固定放在 $2，讓後續 SQL 中的推導欄位（is_expired/days_until_expire）可直接使用
    params.push(asOf);
    const asOfParam = `$${params.length}`;

    if (query.pickup_location_id) {
      params.push(query.pickup_location_id);
      whereClauses.push(`h.pickup_location_id = $${params.length}::uuid`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    try {
      const result = await this.db.query<ReadyHoldsReportRow>(
        `
        SELECT
          -- hold
          h.id AS hold_id,
          h.ready_at,
          h.ready_until,

          -- derived：是否已過期（ready_until < as_of）
          CASE
            WHEN h.ready_until IS NULL THEN false
            ELSE (h.ready_until < ${asOfParam}::timestamptz)
          END AS is_expired,

          -- derived：距離過期還有幾天（可能為負數）
          -- - 若 ready_until 為 NULL（資料不一致），回傳 NULL
          CASE
            WHEN h.ready_until IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (h.ready_until - ${asOfParam}::timestamptz)) / 86400)::int
          END AS days_until_expire,

          -- borrower
          u.id AS user_id,
          u.external_id AS user_external_id,
          u.name AS user_name,
          u.role AS user_role,
          u.org_unit AS user_org_unit,

          -- bib
          b.id AS bibliographic_id,
          b.title AS bibliographic_title,

          -- pickup location
          pl.id AS pickup_location_id,
          pl.code AS pickup_location_code,
          pl.name AS pickup_location_name,

          -- assigned item（ready 理論上一定有；但我們用 LEFT JOIN 容忍資料不一致）
          i.id AS assigned_item_id,
          i.barcode AS assigned_item_barcode,
          i.call_number AS assigned_item_call_number,
          i.status AS assigned_item_status,
          il.code AS assigned_item_location_code,
          il.name AS assigned_item_location_name
        FROM holds h
        JOIN users u
          ON u.id = h.user_id
         AND u.organization_id = h.organization_id
        JOIN bibliographic_records b
          ON b.id = h.bibliographic_id
         AND b.organization_id = h.organization_id
        JOIN locations pl
          ON pl.id = h.pickup_location_id
         AND pl.organization_id = h.organization_id
        LEFT JOIN item_copies i
          ON i.id = h.assigned_item_id
         AND i.organization_id = h.organization_id
        LEFT JOIN locations il
          ON il.id = i.location_id
         AND il.organization_id = i.organization_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY
          -- 先把「已過期但仍在 ready」的列出來（提醒館員跑 maintenance）
          CASE
            WHEN h.ready_until IS NOT NULL AND h.ready_until < ${asOfParam}::timestamptz THEN 0
            ELSE 1
          END ASC,
          -- 再依取書期限排序（越接近期限越前面）
          h.ready_until ASC NULLS LAST,
          -- 取書地點（未過濾時可分區）
          pl.code ASC,
          -- 班級/學號：方便在現場快速找人
          u.org_unit ASC NULLS LAST,
          u.external_id ASC
        LIMIT ${limitParam}
        `,
        params,
      );

      return result.rows;
    } catch (error: any) {
      // 22P02/22007：timestamptz/uuid 解析失敗（as_of 或 pickup_location_id 格式錯）
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  /**
   * US-050：listTopCirculation（熱門書）
   *
   * - 以 loans.checked_out_at 落在 from..to 的借出交易為統計母體
   * - group by bibliographic_records（書目層級）
   * - order by loan_count desc（熱門排行）
   */
  async listTopCirculation(
    orgId: string,
    query: TopCirculationReportQuery,
  ): Promise<TopCirculationRow[]> {
    // 1) 驗證 actor（館員/管理者）
    await this.db.transaction(async (client) => {
      await this.requireStaffActor(client, orgId, query.actor_user_id);
    });

    // 2) from/to：使用者必填（讓「期間」明確，避免不小心掃全表）
    const from = query.from.trim();
    const to = query.to.trim();

    // 前端會先做一次檢查；後端再做一次保險（避免 from > to）
    this.assertRangeOrder(from, to);

    // 3) limit：預設 50，避免一次回太多
    const limit = query.limit ?? 50;

    try {
      const result = await this.db.query<TopCirculationRow>(
        `
        SELECT
          b.id AS bibliographic_id,
          b.title AS bibliographic_title,
          COUNT(l.id)::int AS loan_count,
          COUNT(DISTINCT l.user_id)::int AS unique_borrowers
        FROM loans l
        JOIN item_copies i
          ON i.id = l.item_id
         AND i.organization_id = l.organization_id
        JOIN bibliographic_records b
          ON b.id = i.bibliographic_id
         AND b.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND l.checked_out_at >= $2::timestamptz
          AND l.checked_out_at <= $3::timestamptz
        GROUP BY b.id, b.title
        ORDER BY loan_count DESC, bibliographic_title ASC
        LIMIT $4
        `,
        [orgId, from, to, limit],
      );

      return result.rows;
    } catch (error: any) {
      // 22P02/22007：timestamptz 解析失敗（from/to 格式錯）
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  /**
   * US-050：listCirculationSummary（借閱量彙總）
   *
   * - 以 loans.checked_out_at 作為借出時間
   * - group_by：day/week/month
   * - 使用 generate_series 產生「完整時間軸」，讓沒有借出的一天也會出現 0
   *   （這對圖表或 Excel 報表很重要，不然中間會缺洞）
   */
  async listCirculationSummary(
    orgId: string,
    query: CirculationSummaryReportQuery,
  ): Promise<CirculationSummaryRow[]> {
    // 1) 驗證 actor（館員/管理者）
    await this.db.transaction(async (client) => {
      await this.requireStaffActor(client, orgId, query.actor_user_id);
    });

    const from = query.from.trim();
    const to = query.to.trim();
    this.assertRangeOrder(from, to);

    // 2) 防呆：避免使用者選太長區間導致 generate_series 產生大量列
    // - 例如 group_by=day 但 from/to 跨 20 年 → 7000+ 列
    // - MVP 先設一個合理上限（1000 bucket）
    this.assertBucketCountNotTooLarge(from, to, query.group_by);

    try {
      const result = await this.db.query<CirculationSummaryRow>(
        `
        WITH buckets AS (
          SELECT generate_series(
            date_trunc($4::text, $2::timestamptz),
            date_trunc($4::text, $3::timestamptz),
            CASE
              WHEN $4::text = 'day' THEN interval '1 day'
              WHEN $4::text = 'week' THEN interval '1 week'
              WHEN $4::text = 'month' THEN interval '1 month'
            END
          ) AS bucket_start
        ),
        counts AS (
          SELECT
            date_trunc($4::text, checked_out_at) AS bucket_start,
            COUNT(*)::int AS loan_count
          FROM loans
          WHERE organization_id = $1
            AND checked_out_at >= $2::timestamptz
            AND checked_out_at <= $3::timestamptz
          GROUP BY 1
        )
        SELECT
          b.bucket_start,
          COALESCE(c.loan_count, 0)::int AS loan_count
        FROM buckets b
        LEFT JOIN counts c
          ON c.bucket_start = b.bucket_start
        ORDER BY b.bucket_start ASC
        `,
        [orgId, from, to, query.group_by],
      );

      return result.rows;
    } catch (error: any) {
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  /**
   * buildOverdueCsv：把逾期清單 rows 轉成 CSV 字串（給 controller 回傳）
   *
   * CSV 欄位順序（建議）：
   * - 先放「現場最需要」的欄位（讀者、班級、書名、條碼、到期日、逾期天數）
   * - 再放 ID 欄位（方便系統對帳/二次處理）
   */
  buildOverdueCsv(rows: OverdueReportRow[]) {
    // 1) 欄位定義（header）
    const headers: Array<{ key: keyof OverdueReportRow; label: string }> = [
      { key: 'user_external_id', label: 'user_external_id' },
      { key: 'user_name', label: 'user_name' },
      { key: 'user_role', label: 'user_role' },
      { key: 'user_org_unit', label: 'org_unit' },
      { key: 'bibliographic_title', label: 'title' },
      { key: 'item_barcode', label: 'item_barcode' },
      { key: 'item_call_number', label: 'call_number' },
      { key: 'item_location_code', label: 'location_code' },
      { key: 'item_location_name', label: 'location_name' },
      { key: 'checked_out_at', label: 'checked_out_at' },
      { key: 'due_at', label: 'due_at' },
      { key: 'days_overdue', label: 'days_overdue' },
      // IDs（放最後）
      { key: 'loan_id', label: 'loan_id' },
      { key: 'user_id', label: 'user_id' },
      { key: 'item_id', label: 'item_id' },
      { key: 'bibliographic_id', label: 'bibliographic_id' },
    ];

    // 2) header row
    const headerLine = headers.map((h) => escapeCsvCell(h.label)).join(',');

    // 3) data rows
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h.key];
          return escapeCsvCell(value);
        })
        .join(','),
    );

    // 4) 組合 CSV（加 BOM 讓 Excel 更容易正確顯示 UTF-8）
    // - \ufeff 是 UTF-8 BOM
    // - 使用 \r\n 以提高 Excel/Windows 相容性
    return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
  }

  /**
   * buildReadyHoldsCsv：把取書架清單 rows 轉成 CSV 字串（給 controller 回傳）
   *
   * 欄位順序（建議）：
   * - 先放現場最常用的：取書地點、冊條碼、書名、讀者、班級、到期日
   * - 再放推導欄位（is_expired / days_until_expire）
   * - 最後放 ID（方便對帳）
   */
  buildReadyHoldsCsv(rows: ReadyHoldsReportRow[]) {
    const headers: Array<{ key: keyof ReadyHoldsReportRow; label: string }> = [
      // 現場欄位（先放）
      { key: 'pickup_location_code', label: 'pickup_location_code' },
      { key: 'pickup_location_name', label: 'pickup_location_name' },
      { key: 'assigned_item_barcode', label: 'item_barcode' },
      { key: 'assigned_item_call_number', label: 'call_number' },
      { key: 'bibliographic_title', label: 'title' },
      { key: 'user_external_id', label: 'user_external_id' },
      { key: 'user_name', label: 'user_name' },
      { key: 'user_org_unit', label: 'org_unit' },
      { key: 'ready_until', label: 'ready_until' },
      { key: 'ready_at', label: 'ready_at' },

      // 推導欄位（可用於排序/提醒）
      { key: 'is_expired', label: 'is_expired' },
      { key: 'days_until_expire', label: 'days_until_expire' },

      // 其他參考資訊
      { key: 'assigned_item_status', label: 'item_status' },
      { key: 'assigned_item_location_code', label: 'item_location_code' },
      { key: 'assigned_item_location_name', label: 'item_location_name' },
      { key: 'user_role', label: 'user_role' },

      // IDs（放最後）
      { key: 'hold_id', label: 'hold_id' },
      { key: 'user_id', label: 'user_id' },
      { key: 'bibliographic_id', label: 'bibliographic_id' },
      { key: 'pickup_location_id', label: 'pickup_location_id' },
      { key: 'assigned_item_id', label: 'item_id' },
    ];

    const headerLine = headers.map((h) => escapeCsvCell(h.label)).join(',');
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h.key];
          return escapeCsvCell(value);
        })
        .join(','),
    );

    return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
  }

  /**
   * US-050：buildTopCirculationCsv
   *
   * 欄位順序（建議）：
   * - loan_count（借出次數）
   * - unique_borrowers（借閱人數）
   * - title（書名）
   * - bibliographic_id（方便對帳/跳轉）
   */
  buildTopCirculationCsv(rows: TopCirculationRow[]) {
    const headers: Array<{ key: keyof TopCirculationRow; label: string }> = [
      { key: 'loan_count', label: 'loan_count' },
      { key: 'unique_borrowers', label: 'unique_borrowers' },
      { key: 'bibliographic_title', label: 'title' },
      { key: 'bibliographic_id', label: 'bibliographic_id' },
    ];

    const headerLine = headers.map((h) => escapeCsvCell(h.label)).join(',');
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h.key];
          return escapeCsvCell(value);
        })
        .join(','),
    );

    return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
  }

  /**
   * US-050：buildCirculationSummaryCsv
   *
   * 欄位順序：
   * - bucket_start：這個 bucket 的起始時間（ISO；UTC）
   * - loan_count：該 bucket 的借出筆數
   */
  buildCirculationSummaryCsv(rows: CirculationSummaryRow[]) {
    const headers: Array<{ key: keyof CirculationSummaryRow; label: string }> = [
      { key: 'bucket_start', label: 'bucket_start' },
      { key: 'loan_count', label: 'loan_count' },
    ];

    const headerLine = headers.map((h) => escapeCsvCell(h.label)).join(',');
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h.key];
          return escapeCsvCell(value);
        })
        .join(','),
    );

    return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
  }

  // ----------------------------
  // helpers
  // ----------------------------

  /**
   * requireStaffActor：驗證查詢者是同 org 的 admin/librarian
   *
   * 這是「MVP 的最小權限控管」：
   * - 沒有登入時，actor_user_id 仍可能被冒用
   * - 但至少能避免「完全不帶任何身份」就拿到敏感資料
   */
  private async requireStaffActor(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<ActorRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, actorUserId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Actor user not found' },
      });
    }

    const actor = result.rows[0]!;

    if (actor.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
      });
    }

    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to view reports' },
      });
    }

    return actor;
  }

  /**
   * from/to 合法性（最低限度）
   *
   * 我們把「格式是否為可被 Postgres 解析的 timestamptz」交給 DB；
   * 但 from > to 這類「邏輯錯誤」可以在後端先擋下來，讓錯誤更可讀。
   */
  private assertRangeOrder(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return;

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException({
        error: { code: 'RANGE_INVALID', message: 'from must be earlier than or equal to to' },
      });
    }
  }

  /**
   * generate_series 的安全防呆：限制 bucket 數量
   *
   * - day：1000 天約 2.7 年
   * - week：1000 週約 19 年
   * - month：1000 月約 83 年
   *
   * 對學校現場（學期/學年）而言已足夠，同時避免「誤選 10 年日統計」造成 DB 壓力。
   */
  private assertBucketCountNotTooLarge(
    from: string,
    to: string,
    groupBy: 'day' | 'week' | 'month',
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return;

    const maxBuckets = 1000;
    const count = countBucketsUtc(fromDate, toDate, groupBy);
    if (count > maxBuckets) {
      throw new BadRequestException({
        error: {
          code: 'RANGE_TOO_LARGE',
          message: `Selected range is too large for group_by=${groupBy} (max buckets=${maxBuckets})`,
          details: { bucket_count: count, max_buckets: maxBuckets, group_by: groupBy },
        },
      });
    }
  }
}

/**
 * countBucketsUtc：估算 from..to（含端點）會產生多少 bucket
 *
 * 目的：
 * - 這是「安全防呆」用途，不需要做到 100% 與 Postgres date_trunc 完全一致
 * - 只要能避免極端範圍（例如 10 年日統計）把 DB 打爆即可
 *
 * 實作策略：
 * - day：用 UTC 日期的 00:00 做差
 * - week：用「週一 00:00（UTC）」做差
 * - month：用 YYYY/MM 做差（月份差 + 1）
 */
function countBucketsUtc(from: Date, to: Date, groupBy: 'day' | 'week' | 'month') {
  if (groupBy === 'month') {
    const fromYear = from.getUTCFullYear();
    const fromMonth = from.getUTCMonth();
    const toYear = to.getUTCFullYear();
    const toMonth = to.getUTCMonth();
    return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  }

  const fromStart = bucketStartUtc(from, groupBy);
  const toStart = bucketStartUtc(to, groupBy);

  const diffMs = toStart.getTime() - fromStart.getTime();
  if (diffMs < 0) return 0;

  const diffDays = Math.floor(diffMs / 86_400_000);

  if (groupBy === 'day') return diffDays + 1;
  // week：每週 7 天
  return Math.floor(diffDays / 7) + 1;
}

function bucketStartUtc(date: Date, groupBy: 'day' | 'week') {
  // day：當天 00:00（UTC）
  if (groupBy === 'day') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // week：Postgres date_trunc('week', ...) 的概念是「週一 00:00」
  // - JS getUTCDay(): 0=Sun, 1=Mon, ... 6=Sat
  // - 轉成「距離週一的天數」：Mon=0, Tue=1, ... Sun=6
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  startOfDay.setUTCDate(startOfDay.getUTCDate() - daysSinceMonday);
  return startOfDay;
}

/**
 * escapeCsvCell：把任意值安全轉成 CSV cell
 *
 * CSV 規則（RFC 4180 常見實務）：
 * - 若 cell 含有 `"`、`,`、`\n`、`\r`，就必須用雙引號包起來
 * - 內部的 `"` 需要變成 `""`
 */
function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);

  const mustQuote =
    text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r');

  if (!mustQuote) return text;

  // 把 " 變成 ""（CSV 的 escape 規則）
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}
