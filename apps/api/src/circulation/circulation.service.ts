/**
 * CirculationService
 *
 * 實作借出（checkout）、歸還（checkin）、續借（renew）的交易流程：
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
import { assertBorrowingAllowedByOverdue } from '../common/borrowing-block';
import { DbService } from '../db/db.service';
import type { CheckinInput, CheckoutInput, RenewInput } from './circulation.schemas';

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
  max_renewals: number;
  hold_pickup_days: number;
  overdue_block_days: number;
};

type LoanRow = {
  id: string;
  user_id: string;
  item_id: string;
  due_at: string;
};

// renew 需要更多 loan 欄位（returned_at / renewed_count），因此另定義 type。
type LoanForRenewRow = {
  id: string;
  user_id: string;
  item_id: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
};

// 為了維持鎖順序（item → loan），renew 會先「用 loan_id 找到 item 並鎖 item」。
type LoanRenewContextRow = {
  id: string;
  user_id: string;
  item_id: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
  bibliographic_id: string;
  item_status: ItemStatus;
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
      return await this.db.transactionWithOrg(orgId, async (client) => {
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

        // 6) 逾期停權（政策）：若逾期達 X 天，禁止新增借閱。
        // - 規則由 loans 推導（不額外存 suspended 狀態），避免資料不一致
        await assertBorrowingAllowedByOverdue(client, orgId, borrower.id, policy.overdue_block_days);

        // 7) 檢查借閱上限（同時可借 max_loans）。
        const openLoanCount = await this.countOpenLoansForUser(client, orgId, borrower.id);
        if (openLoanCount >= policy.max_loans) {
          throw new ConflictException({
            error: { code: 'LOAN_LIMIT_REACHED', message: 'User has reached max loans' },
          });
        }

        // 8) 建立 loan（due_at 使用 DB 的 now() + loan_days）。
        const loanResult = await client.query<LoanRow>(
          `
          INSERT INTO loans (organization_id, item_id, user_id, due_at)
          VALUES ($1, $2, $3, now() + ($4::int * interval '1 day'))
          RETURNING id, user_id, item_id, due_at
          `,
          [orgId, item.id, borrower.id, policy.loan_days],
        );
        const loan = loanResult.rows[0]!;

        // 9) 更新冊狀態為 checked_out。
        await client.query(
          `
          UPDATE item_copies
          SET status = 'checked_out', updated_at = now()
          WHERE id = $1
          `,
          [item.id],
        );

        // 10) 寫入稽核事件（actor_user_id 來自 request）。
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

        // 11) 回傳 checkout 結果（前端用來顯示到期日）。
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
      return await this.db.transactionWithOrg(orgId, async (client) => {
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

  async renew(orgId: string, input: RenewInput) {
    try {
      return await this.db.transactionWithOrg(orgId, async (client) => {
        // renew 是「修改 loan」的操作，因此同樣需要交易：
        // - 讀取 loan / item / policy（用來判斷可否續借）
        // - 更新 loans.due_at + loans.renewed_count
        // - 寫入 audit_events

        // 1) 先取得 actor（操作者），並確認其狀態為 active。
        //    注意：目前沒有 auth，所以 actor_user_id 由前端傳入。
        const actor = await this.requireUserById(client, orgId, input.actor_user_id);

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        // 2) 先「用 loan_id 找到 item 並鎖定 item」（FOR UPDATE OF item_copies）
        //    為什麼要先鎖 item？
        //    - checkout/checkin 都是先鎖 item，再鎖 loan
        //    - renew 若反過來（先鎖 loan 再鎖 item）可能與 checkin 形成死結
        const context = await this.requireLoanRenewContextAndLockItem(
          client,
          orgId,
          input.loan_id,
        );

        // item 必須處於 checked_out 才有「續借」的語意。
        // - 若 item 已被標記 lost/withdrawn/repair，續借應該被拒絕（資料一致性與流程合理性）
        if (context.item_status !== 'checked_out') {
          throw new ConflictException({
            error: {
              code: 'RENEW_NOT_ALLOWED',
              message: 'Item is not checked out; cannot renew',
            },
          });
        }

        // 3) 鎖定 loan（FOR UPDATE），並再次確認 loan 存在且仍為 open。
        const loan = await this.requireLoanByIdForUpdate(client, orgId, input.loan_id);

        // returned_at 不為 null 代表已歸還（closed），不能續借。
        if (loan.returned_at) {
          throw new ConflictException({
            error: { code: 'LOAN_NOT_OPEN', message: 'Loan is closed; cannot renew' },
          });
        }

        // 4) 取得 borrower（借閱者），並確認其仍可借（active + student/teacher）。
        const borrower = await this.requireBorrowerById(client, orgId, loan.user_id);

        // 5) 權限規則（MVP 版本）：
        // - admin/librarian：可替他人續借（館員操作）
        // - teacher/student：僅允許「替自己續借」（actor_user_id 必須等於 loan.user_id）
        const actorIsStaff = ACTOR_ROLES.includes(actor.role);
        const actorIsSelfBorrower =
          BORROWER_ROLES.includes(actor.role) && actor.id === borrower.id;

        if (!actorIsStaff && !actorIsSelfBorrower) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to renew this loan' },
          });
        }

        // 6) 取得對應政策（依 borrower.role），用來判斷續借上限與延長天數。
        const policy = await this.getPolicyForRole(client, orgId, borrower.role);
        if (!policy) {
          throw new NotFoundException({
            error: { code: 'POLICY_NOT_FOUND', message: 'Circulation policy not found' },
          });
        }

        // 7) 逾期停權（政策）：若逾期達 X 天，禁止續借（視為延長借閱）。
        await assertBorrowingAllowedByOverdue(client, orgId, borrower.id, policy.overdue_block_days);

        // 8) 檢查續借次數上限：renewed_count < max_renewals 才能續借。
        if (loan.renewed_count >= policy.max_renewals) {
          throw new ConflictException({
            error: { code: 'RENEW_LIMIT_REACHED', message: 'Loan has reached max renewals' },
          });
        }

        // 9) 若有人排隊（queued hold），通常不允許續借（公平性）。
        //    這裡先做最小規則：只要同書目有 queued hold，就拒絕 renew。
        const hasQueuedHold = await this.hasQueuedHold(
          client,
          orgId,
          context.bibliographic_id,
        );

        if (hasQueuedHold) {
          throw new ConflictException({
            error: {
              code: 'RENEW_NOT_ALLOWED_DUE_TO_HOLD',
              message: 'Renew not allowed because there are queued holds for this title',
            },
          });
        }

        // 10) 更新 loan：延長 due_at + renewed_count +1
        //    延長策略：從「現在與原 due_at 的較大者」開始加天數（避免提早續借反而縮短期限）。
        const oldDueAt = loan.due_at;

        const updated = await client.query<{ due_at: string; renewed_count: number }>(
          `
          UPDATE loans
          SET
            due_at = GREATEST(due_at, now()) + ($1::int * interval '1 day'),
            renewed_count = renewed_count + 1
          WHERE organization_id = $2
            AND id = $3
            AND returned_at IS NULL
          RETURNING due_at, renewed_count
          `,
          [policy.loan_days, orgId, loan.id],
        );

        // 若 rowCount=0，代表 loan 已不再是 open（理論上已鎖定，這裡保險處理）。
        if (updated.rowCount === 0) {
          throw new ConflictException({
            error: { code: 'LOAN_NOT_OPEN', message: 'Loan is closed; cannot renew' },
          });
        }

        const newDueAt = updated.rows[0]!.due_at;
        const renewedCount = updated.rows[0]!.renewed_count;

        // 11) 寫入 audit_events：記錄誰把哪一筆 loan 續借、期限如何變動。
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
            'loan.renew',
            'loan',
            loan.id,
            JSON.stringify({
              item_id: loan.item_id,
              user_id: loan.user_id,
              old_due_at: oldDueAt,
              new_due_at: newDueAt,
              renewed_count: renewedCount,
            }),
          ],
        );

        // 12) 回傳 renew 結果（前端可用於更新列表與顯示到期日）。
        return {
          loan_id: loan.id,
          item_id: loan.item_id,
          user_id: loan.user_id,
          due_at: newDueAt,
          renewed_count: renewedCount,
        };
      });
    } catch (error: any) {
      // renew 不會碰到 23505（unique），但仍可能因 FK 或格式造成錯誤。
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

  /**
   * 取得 user（以 id），不做角色判斷。
   *
   * 用途：
   * - renew：actor 可能是館員（admin/librarian）或借閱者本人（student/teacher）
   * - 未來若加上 auth，可用 token 直接推導 actor，不一定需要這支查詢
   */
  private async requireUserById(client: PoolClient, orgId: string, userId: string) {
    const result = await client.query<UserRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * 取得 borrower（以 user id），並套用 borrower 的基本限制（active + role 支援）。
   *
   * 這與 `requireBorrowerByExternalId` 的檢查一致，只是查詢鍵不同。
   */
  private async requireBorrowerById(client: PoolClient, orgId: string, borrowerUserId: string) {
    const borrower = await this.requireUserById(client, orgId, borrowerUserId);

    if (borrower.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Borrower is inactive' },
      });
    }

    if (!BORROWER_ROLES.includes(borrower.role)) {
      throw new BadRequestException({
        error: { code: 'UNSUPPORTED_ROLE', message: 'Borrower role is not supported' },
      });
    }

    return borrower;
  }

  /**
   * renew 專用：用 loan_id 找到 item 並先鎖定 item（維持鎖順序 item → loan）
   *
   * 為什麼不直接「先鎖 loan」？
   * - checkin 的鎖順序是：item（FOR UPDATE）→ loan（FOR UPDATE）
   * - renew 若反過來（loan → item），在高併發下可能產生死結（deadlock）
   */
  private async requireLoanRenewContextAndLockItem(
    client: PoolClient,
    orgId: string,
    loanId: string,
  ): Promise<LoanRenewContextRow> {
    const result = await client.query<LoanRenewContextRow>(
      `
      SELECT
        l.id,
        l.user_id,
        l.item_id,
        l.due_at,
        l.returned_at,
        l.renewed_count,
        i.bibliographic_id,
        i.status AS item_status
      FROM loans l
      JOIN item_copies i
        ON i.id = l.item_id
       AND i.organization_id = l.organization_id
      WHERE l.organization_id = $1
        AND l.id = $2
      FOR UPDATE OF i
      `,
      [orgId, loanId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Loan not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * renew 專用：鎖定 loan row（FOR UPDATE）
   *
   * 注意：
   * - 這支函式只負責「存在性 + 鎖定」，不負責 open/closed 判斷
   * - open/closed 的判斷交給呼叫端，用 returned_at 來決定（語意更直覺）
   */
  private async requireLoanByIdForUpdate(
    client: PoolClient,
    orgId: string,
    loanId: string,
  ): Promise<LoanForRenewRow> {
    const result = await client.query<LoanForRenewRow>(
      `
      SELECT id, user_id, item_id, due_at, returned_at, renewed_count
      FROM loans
      WHERE organization_id = $1
        AND id = $2
      FOR UPDATE
      `,
      [orgId, loanId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Loan not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * renew 專用：判斷某書目是否存在 queued holds
   *
   * 續借是否應該被 hold 阻擋，各館政策可能不同；MVP 先採「只要有人排隊就不給續借」。
   *
   * 這裡用 EXISTS 查詢：
   * - 好處：不需要鎖定資料列（純讀取）
   * - 成本低：找到第一筆就能停
   */
  private async hasQueuedHold(client: PoolClient, orgId: string, bibId: string) {
    const result = await client.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM holds
        WHERE organization_id = $1
          AND bibliographic_id = $2
          AND status = 'queued'
      ) AS exists
      `,
      [orgId, bibId],
    );

    return result.rows[0]?.exists ?? false;
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
      SELECT id, loan_days, max_loans, max_renewals, hold_pickup_days, overdue_block_days
      FROM circulation_policies
      WHERE organization_id = $1
        AND audience_role = $2::user_role
        AND is_active = true
      -- 同 role 同時只允許一筆 active policy（DB partial unique index 保證）
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
      -- policy（取「有效政策」）：
      -- - circulation_policies 允許同 role 多筆（代表可保留歷史版本）
      -- - 但每個 role 同時只允許一筆 is_active=true（由 DB partial unique index 保證）
      -- - 用 LATERAL subquery 讓每筆 hold 都能拿到「該 borrower.role 的有效 hold_pickup_days」
      LEFT JOIN LATERAL (
        SELECT cp.hold_pickup_days
        FROM circulation_policies cp
        WHERE cp.organization_id = h.organization_id
          AND cp.audience_role = u.role
          AND cp.is_active = true
        LIMIT 1
      ) p ON true
      WHERE h.organization_id = $1
        AND h.bibliographic_id = $2
        AND h.status = 'queued'
      ORDER BY h.placed_at ASC
      LIMIT 1
      -- 只鎖隊首 hold，避免把 users/policies 一起鎖住造成等待
      FOR UPDATE OF h
      `,
      [orgId, bibId],
    );

    return result.rows[0] ?? null;
  }
}
