/**
 * Borrowing Block（逾期停權 / 借閱限制）
 *
 * 需求來源：MVP-SPEC.md
 * - 學校現場常見規則：逾期達 X 天後，暫停「新增借閱」權限
 * - 本專案把「新增借閱」定義為：
 *   - checkout（借出）
 *   - renew（續借：延長到期日，等同延長借閱）
 *   - hold create（新增預約：代表預期要借，避免堆積）
 *   - hold fulfill（取書借出：建立 loan，屬於借閱）
 *
 * 實作策略（MVP）：
 * - 不新增 users.suspended 欄位（避免多個來源寫入/解除造成不一致）
 * - 直接由 loans 推導「是否應停權」：
 *   - 若有任何 open loan（returned_at IS NULL）且 days_overdue >= overdue_block_days → blocked
 *
 * 為什麼做成 common helper？
 * - circulation / holds 都需要同一套規則
 * - 把錯誤碼與 details 統一，Web 才能一致顯示「被停權原因」
 */

import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';

export type BorrowingBlockedDetails = {
  // overdue_block_days：政策門檻（>= 這個天數就停權）
  overdue_block_days: number;

  // overdue_loan_count：目前逾期中的 open loans 數量（due_at < now()）
  overdue_loan_count: number;

  // max_days_overdue：目前逾期中最嚴重的天數（整天數）
  max_days_overdue: number;

  // example_overdue_loan_ids：給 UI/除錯用的範例（最多 3 筆）
  example_overdue_loan_ids: string[];
};

/**
 * assertBorrowingAllowedByOverdue
 *
 * - overdueBlockDays=0：代表不啟用 → 永遠允許
 * - overdueBlockDays>0：
 *   - 若存在 days_overdue >= overdueBlockDays 的 open loan → 丟出 ConflictException
 *
 * 注意：
 * - days_overdue 的定義採「整天數」：
 *   - FLOOR((now - due_at) / 86400)
 * - 這與 /reports/overdue 的 days_overdue 推導一致（避免同一筆資料在不同地方算出不同天數）
 */
export async function assertBorrowingAllowedByOverdue(
  client: PoolClient,
  orgId: string,
  borrowerId: string,
  overdueBlockDays: number,
) {
  // 0 代表不啟用（MVP 允許某些學校不做停權）
  if (overdueBlockDays <= 0) return;

  // 1) 先算「目前最大逾期天數」與「逾期筆數」
  const summary = await client.query<{
    overdue_loan_count: number;
    max_days_overdue: number;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE due_at < now())::int AS overdue_loan_count,
      COALESCE(
        MAX(FLOOR(EXTRACT(EPOCH FROM (now() - due_at)) / 86400)::int) FILTER (WHERE due_at < now()),
        0
      )::int AS max_days_overdue
    FROM loans
    WHERE organization_id = $1
      AND user_id = $2
      AND returned_at IS NULL
    `,
    [orgId, borrowerId],
  );

  const row = summary.rows[0] ?? { overdue_loan_count: 0, max_days_overdue: 0 };

  // 2) 判斷是否達到停權門檻
  if (row.max_days_overdue < overdueBlockDays) return;

  // 3) 取幾筆範例 loan_id（方便 UI 顯示或除錯）
  const examples = await client.query<{ id: string }>(
    `
    SELECT id
    FROM loans
    WHERE organization_id = $1
      AND user_id = $2
      AND returned_at IS NULL
      AND due_at < now()
      AND FLOOR(EXTRACT(EPOCH FROM (now() - due_at)) / 86400)::int >= $3::int
    ORDER BY due_at ASC
    LIMIT 3
    `,
    [orgId, borrowerId, overdueBlockDays],
  );

  const exampleIds = examples.rows.map((r) => r.id);

  // 4) 丟出一致的錯誤碼 + details
  // - 使用 Conflict（409）代表「目前狀態不允許進行此動作」
  // - Web 端可用 details 顯示「為什麼被擋」
  const details: BorrowingBlockedDetails = {
    overdue_block_days: overdueBlockDays,
    overdue_loan_count: row.overdue_loan_count,
    max_days_overdue: row.max_days_overdue,
    example_overdue_loan_ids: exampleIds,
  };

  throw new ConflictException({
    error: {
      code: 'BORROWING_BLOCKED_DUE_TO_OVERDUE',
      message: 'Borrower is blocked due to overdue loans',
      details,
    },
  });
}

