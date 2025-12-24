/**
 * CirculationService
 *
 * 實作借出（checkout）與歸還（checkin）的交易流程：
 * - 需要同時更新 loans / item_copies / audit_events
 * - 必須用 transaction 保證「要嘛全成功，要嘛全失敗」
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
import type { CheckinInput, CheckoutInput } from './circulation.schemas';

// 角色列舉（與 db/schema.sql 的 user_role enum 對齊）。
type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

// 借閱者（borrower）允許的角色（MVP 先做 student/teacher）。
const BORROWER_ROLES: UserRole[] = ['student', 'teacher'];

// 操作者（actor）允許的角色（沒有 auth 時，用這個做最小 RBAC）。
const ACTOR_ROLES: UserRole[] = ['admin', 'librarian'];

// 若找不到政策的 hold_pickup_days，先用這個保底。
const DEFAULT_HOLD_PICKUP_DAYS = 3;

type UserRow = {
  id: string;
  role: UserRole;
  status: UserStatus;
};

type ItemRow = {
  id: string;
  bibliographic_id: string;
  status: ItemStatus;
};

type PolicyRow = {
  id: string;
  loan_days: number;
  max_loans: number;
  hold_pickup_days: number;
};

type LoanRow = {
  id: string;
  user_id: string;
  item_id: string;
  due_at: string;
};

type HoldCandidateRow = {
  id: string;
  user_id: string;
  hold_pickup_days: number | null;
};

@Injectable()
export class CirculationService {
  constructor(private readonly db: DbService) {}

  async checkout(orgId: string, input: CheckoutInput) {
    try {
      return await this.db.transaction(async (client) => {
        // 1) 驗證操作者：確定是同 org 的館員/管理者。
        const actor = await this.requireActor(client, orgId, input.actor_user_id);

        // 2) 取得借閱者（以 external_id 搜尋），並確認可借狀態。
        const borrower = await this.requireBorrowerByExternalId(
          client,
          orgId,
          input.user_external_id,
        );

        // 3) 以條碼鎖定冊（FOR UPDATE），避免同冊同時被借出。
        const item = await this.requireItemByBarcodeForUpdate(
          client,
          orgId,
          input.item_barcode,
        );

        // 4) 冊必須是 available；若已借出/保留/遺失就拒絕。
        if (item.status !== 'available') {
          throw new ConflictException({
            error: { code: 'ITEM_NOT_AVAILABLE', message: 'Item is not available for checkout' },
          });
        }

        // 5) 取得對應政策（依 borrower.role），用來算 due_at 與借閱上限。
        const policy = await this.getPolicyForRole(client, orgId, borrower.role);
        if (!policy) {
          throw new NotFoundException({
            error: { code: 'POLICY_NOT_FOUND', message: 'Circulation policy not found' },
          });
        }

        // 6) 檢查借閱上限（同時可借 max_loans）。
        const openLoanCount = await this.countOpenLoansForUser(client, orgId, borrower.id);
        if (openLoanCount >= policy.max_loans) {
          throw new ConflictException({
            error: { code: 'LOAN_LIMIT_REACHED', message: 'User has reached max loans' },
          });
        }

        // 7) 建立 loan（due_at 使用 DB 的 now() + loan_days）。
        const loanResult = await client.query<LoanRow>(
          `
          INSERT INTO loans (organization_id, item_id, user_id, due_at)
          VALUES ($1, $2, $3, now() + ($4::int * interval '1 day'))
          RETURNING id, user_id, item_id, due_at
          `,
          [orgId, item.id, borrower.id, policy.loan_days],
        );
        const loan = loanResult.rows[0]!;

        // 8) 更新冊狀態為 checked_out。
        await client.query(
          `
          UPDATE item_copies
          SET status = 'checked_out', updated_at = now()
          WHERE id = $1
          `,
          [item.id],
        );

        // 9) 寫入稽核事件（actor_user_id 來自 request）。
        await client.query(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            orgId,
            actor.id,
            'loan.checkout',
            'loan',
            loan.id,
            JSON.stringify({
              item_id: loan.item_id,
              user_id: loan.user_id,
              item_barcode: input.item_barcode,
            }),
          ],
        );

        // 10) 回傳 checkout 結果（前端用來顯示到期日）。
        return {
          loan_id: loan.id,
          item_id: loan.item_id,
          user_id: loan.user_id,
          due_at: loan.due_at,
        };
      });
    } catch (error: any) {
      // 23505：同冊同時只能有一筆未歸還借閱（partial unique index）。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'ITEM_ALREADY_CHECKED_OUT', message: 'Item already checked out' },
        });
      }
      // 23503：FK 不存在（理論上已檢查，這裡保險）。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      // 22P02：UUID/enum 轉型失敗。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async checkin(orgId: string, input: CheckinInput) {
    try {
      return await this.db.transaction(async (client) => {
        // 1) 驗證操作者（館員/管理者）。
        const actor = await this.requireActor(client, orgId, input.actor_user_id);

        // 2) 以條碼鎖定冊，避免同時歸還/更新狀態。
        const item = await this.requireItemByBarcodeForUpdate(
          client,
          orgId,
          input.item_barcode,
        );

        // 3) 找到該冊的 open loan（returned_at IS NULL）。
        const loan = await this.requireOpenLoanForItem(client, orgId, item.id);

        // 4) 關閉 loan：寫入 returned_at + status=closed。
        await client.query(
          `
          UPDATE loans
          SET returned_at = now(), status = 'closed'
          WHERE id = $1
          `,
          [loan.id],
        );

        // 5) 若有排隊中的 hold，就把冊指派給隊首。
        const hold = await this.findNextQueuedHold(client, orgId, item.bibliographic_id);

        let newStatus: ItemStatus = 'available';
        let holdId: string | null = null;
        let readyUntil: string | null = null;

        if (hold) {
          // 5.1 依 hold 使用者的政策決定保留天數（沒有就用預設）。
          const pickupDays = hold.hold_pickup_days ?? DEFAULT_HOLD_PICKUP_DAYS;

          // 5.2 更新 hold：ready + 指派冊 + 設定保留期限。
          const holdUpdate = await client.query<{ ready_until: string }>(
            `
            UPDATE holds
            SET status = 'ready',
                assigned_item_id = $1,
                ready_at = now(),
                ready_until = now() + ($2::int * interval '1 day')
            WHERE id = $3
            RETURNING ready_until
            `,
            [item.id, pickupDays, hold.id],
          );

          newStatus = 'on_hold';
          holdId = hold.id;
          readyUntil = holdUpdate.rows[0]?.ready_until ?? null;
        }

        // 6) 更新冊狀態（有 hold => on_hold，否則 available）。
        await client.query(
          `
          UPDATE item_copies
          SET status = $1::item_status, updated_at = now()
          WHERE id = $2
          `,
          [newStatus, item.id],
        );

        // 7) 寫入稽核事件（含 hold 指派資訊）。
        await client.query(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            orgId,
            actor.id,
            'loan.checkin',
            'loan',
            loan.id,
            JSON.stringify({
              item_id: item.id,
              user_id: loan.user_id,
              item_barcode: input.item_barcode,
              hold_id: holdId,
            }),
          ],
        );

        // 8) 回傳 checkin 結果（前端可用於顯示新狀態）。
        return {
          loan_id: loan.id,
          item_id: item.id,
          item_status: newStatus,
          hold_id: holdId,
          ready_until: readyUntil,
        };
      });
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  private async requireActor(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<UserRow>(
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

    // status=inactive 的使用者不能做操作。
    if (actor.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
      });
    }

    // 最小 RBAC：僅允許 admin/librarian 操作借還。
    if (!ACTOR_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to perform circulation' },
      });
    }

    return actor;
  }

  private async requireBorrowerByExternalId(
    client: PoolClient,
    orgId: string,
    externalId: string,
  ) {
    const result = await client.query<UserRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND external_id = $2
      `,
      [orgId, externalId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Borrower not found' },
      });
    }

    const borrower = result.rows[0]!;

    // 借閱者若已停用，直接拒絕借書。
    if (borrower.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Borrower is inactive' },
      });
    }

    // MVP 先只允許 student/teacher 借閱（對應 policy audience_role）。
    if (!BORROWER_ROLES.includes(borrower.role)) {
      throw new BadRequestException({
        error: { code: 'UNSUPPORTED_ROLE', message: 'Borrower role is not supported' },
      });
    }

    return borrower;
  }

  private async requireItemByBarcodeForUpdate(
    client: PoolClient,
    orgId: string,
    barcode: string,
  ) {
    const result = await client.query<ItemRow>(
      `
      SELECT id, bibliographic_id, status
      FROM item_copies
      WHERE organization_id = $1
        AND barcode = $2
      FOR UPDATE
      `,
      [orgId, barcode],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    return result.rows[0]!;
  }

  private async getPolicyForRole(client: PoolClient, orgId: string, role: UserRole) {
    const result = await client.query<PolicyRow>(
      `
      SELECT id, loan_days, max_loans, hold_pickup_days
      FROM circulation_policies
      WHERE organization_id = $1
        AND audience_role = $2::user_role
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [orgId, role],
    );

    return result.rows[0] ?? null;
  }

  private async countOpenLoansForUser(client: PoolClient, orgId: string, userId: string) {
    const result = await client.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM loans
      WHERE organization_id = $1
        AND user_id = $2
        AND returned_at IS NULL
      `,
      [orgId, userId],
    );

    return result.rows[0]?.count ?? 0;
  }

  private async requireOpenLoanForItem(client: PoolClient, orgId: string, itemId: string) {
    const result = await client.query<LoanRow>(
      `
      SELECT id, user_id, item_id, due_at
      FROM loans
      WHERE organization_id = $1
        AND item_id = $2
        AND returned_at IS NULL
      FOR UPDATE
      `,
      [orgId, itemId],
    );

    if (result.rowCount === 0) {
      throw new ConflictException({
        error: { code: 'LOAN_NOT_FOUND', message: 'No open loan for this item' },
      });
    }

    return result.rows[0]!;
  }

  private async findNextQueuedHold(client: PoolClient, orgId: string, bibId: string) {
    const result = await client.query<HoldCandidateRow>(
      `
      SELECT
        h.id,
        h.user_id,
        p.hold_pickup_days
      FROM holds h
      JOIN users u
        ON u.id = h.user_id
       AND u.organization_id = h.organization_id
      LEFT JOIN circulation_policies p
        ON p.organization_id = h.organization_id
       AND p.audience_role = u.role
      WHERE h.organization_id = $1
        AND h.bibliographic_id = $2
        AND h.status = 'queued'
      ORDER BY h.placed_at ASC
      LIMIT 1
      FOR UPDATE
      `,
      [orgId, bibId],
    );

    return result.rows[0] ?? null;
  }
}
