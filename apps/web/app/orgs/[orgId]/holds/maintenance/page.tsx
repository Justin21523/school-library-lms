/**
 * Holds Maintenance Page（/orgs/:orgId/holds/maintenance）
 *
 * 目的：
 * - 這頁放「館員每日例行作業」：最先落地的是「到書未取 → 逾期處理」
 * - 把 ready_until 過期的 holds 標記為 expired，並釋放/轉派冊
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/holds/expire-ready（mode=preview|apply）
 *
 * Auth/權限（重要）：
 * - 這頁屬於 staff 維運工具，因此需要先在 `/orgs/:orgId/login` 登入取得 Bearer token
 * - actor_user_id 由「登入者本人」推導（session.user.id），不再提供下拉選擇（避免冒用）
 * - 後端會寫入 audit_events（action=hold.expire），讓你事後可追溯「誰處理了哪些到期」
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  ExpireReadyHoldsApplyResult,
  ExpireReadyHoldsPreviewResult,
  HoldWithDetails,
} from '../../../../lib/api';
import { applyExpireReadyHolds, previewExpireReadyHolds } from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable } from '../../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

function toDateTimeLocalValue(date: Date) {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function HoldsMaintenancePage({ params }: { params: { orgId: string } }) {
  // Staff session：本頁所有 API 都被 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：由登入者本人推導，並在 request 中送回 API（供 audit 與 RBAC）。
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 1) 參數：as_of / limit / note
  // ----------------------------

  // asOfLocal：可留空；留空代表「由後端用 DB now() 判定」
  // - 預設給現在，讓你直接按 preview 就能看到清單
  const [asOfLocal, setAsOfLocal] = useState(() => toDateTimeLocalValue(new Date()));

  const [limit, setLimit] = useState('200');
  const [note, setNote] = useState('');

  // ----------------------------
  // 3) 結果：preview / apply
  // ----------------------------

  const [preview, setPreview] = useState<ExpireReadyHoldsPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ExpireReadyHoldsApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 登入門檻：未登入就不顯示操作 UI，避免一直撞 401/403。
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Holds Maintenance" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="Holds Maintenance"
          description="這頁需要 staff 登入（StaffAuthGuard），才能 preview/apply 到期處理。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  function buildRequestInput() {
    // 由於我們已先做登入門檻（session 必存在），這裡的檢查是保險用。
    if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

    const trimmedLimit = limit.trim();
    const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
    if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

    // as_of：允許留空 → 不送，讓後端用 DB now()
    const asOfIso = asOfLocal.trim() ? fromDateTimeLocalToIso(asOfLocal) : null;
    if (asOfLocal.trim() && !asOfIso) throw new Error('as_of 格式不正確（請重新選擇日期時間）');

    return {
      actor_user_id: actorUserId,
      ...(asOfIso ? { as_of: asOfIso } : {}),
      ...(limitNumber ? { limit: limitNumber } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);

    try {
      const input = buildRequestInput();
      const result = await previewExpireReadyHolds(params.orgId, input);
      setPreview(result);

      if (result.candidates_total === 0) {
        setSuccess('目前沒有已過期的 ready holds。');
      } else {
        setSuccess(
          `預覽完成：已過期 ${result.candidates_total} 筆（本次顯示 ${result.holds.length} 筆；limit=${result.limit}；as_of=${result.as_of}）`,
        );
      }
    } catch (e) {
      setPreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply() {
    setApplying(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);

    try {
      const input = buildRequestInput();

      // UX：若有 preview 結果，套用前用 preview 的摘要做確認（降低誤操作）
      const count = preview?.candidates_total ?? null;
      const ok = window.confirm(
        `確認要執行到期處理嗎？\n\n` +
          (count !== null ? `已過期（preview）：${count} 筆\n` : '') +
          `limit：${input.limit ?? '200'}\n` +
          `as_of：${input.as_of ?? 'DB now()'}\n\n` +
          `此動作會：\n` +
          `- 把過期 ready hold → expired\n` +
          `- 釋放冊回 available 或轉派給下一位 queued\n` +
          `- 寫入 audit_events（hold.expire）`,
      );
      if (!ok) return;

      const result = await applyExpireReadyHolds(params.orgId, input);
      setApplyResult(result);
      setSuccess(
        `已完成到期處理：processed=${result.summary.processed} · transferred=${result.summary.transferred} · released=${result.summary.released} · skipped_item_action=${result.summary.skipped_item_action}`,
      );

      // apply 後，preview 可能已過期；清掉避免誤判
      setPreview(null);
    } catch (e) {
      setApplyResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  const previewRankByHoldId = useMemo(() => {
    const m = new Map<string, number>();
    (preview?.holds ?? []).forEach((h, idx) => m.set(h.id, idx + 1));
    return m;
  }, [preview]);

  const applyRankByAuditEventId = useMemo(() => {
    const m = new Map<string, number>();
    (applyResult?.results ?? []).forEach((r, idx) => m.set(r.audit_event_id, idx + 1));
    return m;
  }, [applyResult]);

  return (
    <div className="stack">
      <PageHeader
        title="Holds Maintenance"
        description={
          <>
            到期處理（ready_until → expired）。套用後可到 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
            <code>hold.expire</code> 追溯。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/holds`}>
              Holds 工作台
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/audit-events`}>
              Audit Events
            </Link>
          </>
        }
      >
        <div className="muted">
          actor_user_id（操作者）：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </div>
        <Alert variant="warning" title="安全提示">
          建議先按 <strong>Preview</strong> 確認候選清單與筆數，再按 <strong>Apply</strong> 執行到期處理（會寫入 audit）。
        </Alert>

        <Form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
          <FormSection title="參數" description="as_of 可留空（後端用 DB now()）；note 會寫入 audit metadata 方便追溯。">
            <Field label="as_of（選填；留空則使用後端 DB now()）" htmlFor="holds_as_of">
              <input
                id="holds_as_of"
                type="datetime-local"
                value={asOfLocal}
                onChange={(e) => setAsOfLocal(e.target.value)}
              />
            </Field>

            <div className="grid2">
              <Field label="limit（一次最多處理幾筆；預設 200）" htmlFor="holds_limit">
                <input id="holds_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
              <Field label="note（選填；寫入 audit metadata）" htmlFor="holds_note" hint="例：每日到期處理 / 連假後補處理">
                <input
                  id="holds_note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例：每日到期處理 / 連假後補處理"
                />
              </Field>
            </div>

            <FormActions>
              <button type="button" className="btnPrimary" onClick={() => void runPreview()} disabled={previewing || applying}>
                {previewing ? '預覽中…' : '預覽（Preview）'}
              </button>
              <button type="button" className="btnDanger" onClick={() => void runApply()} disabled={applying || previewing}>
                {applying ? '套用中…' : '套用（Apply）'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setPreview(null);
                  setApplyResult(null);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={previewing || applying}
              >
                清除結果
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {previewing || applying ? <Alert variant="info" title={previewing ? '預覽中…' : '套用中…'} role="status" /> : null}
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      {previewing && !preview ? (
        <section className="panel">
          <SectionHeader title="Preview 結果" />
          <SkeletonTable columns={7} rows={6} />
        </section>
      ) : null}

      {preview ? (
        <section className="panel">
          <SectionHeader title="Preview 結果" />
          <Alert variant="info" title="Preview 摘要" role="status">
            as_of=<code>{preview.as_of}</code> · candidates_total=<code>{preview.candidates_total}</code> · showing=
            <code>{preview.holds.length}</code> · limit=<code>{preview.limit}</code>
          </Alert>

          {preview.holds.length === 0 ? (
            <EmptyState title="沒有需要處理的 holds" description="代表目前沒有 ready_until 已過期的 ready holds。" />
          ) : (
            <DataTable<HoldWithDetails>
              rows={preview.holds}
              getRowKey={(h) => h.id}
              initialSort={{ columnId: 'rank', direction: 'asc' }}
              sortHint="Preview 清單一次載入；排序會即時套用在目前結果。"
              columns={[
                {
                  id: 'rank',
                  header: '#（API rank）',
                  cell: (h) => <code>{previewRankByHoldId.get(h.id) ?? '—'}</code>,
                  sortValue: (h) => previewRankByHoldId.get(h.id) ?? 0,
                  align: 'right',
                  width: 120,
                },
                {
                  id: 'borrower',
                  header: 'borrower',
                  cell: (h) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div>{h.user_name}</div>
                      <div className="muted">
                        <code>{h.user_external_id}</code> · {h.user_role}
                      </div>
                    </div>
                  ),
                  sortValue: (h) => h.user_external_id,
                  width: 220,
                },
                {
                  id: 'title',
                  header: 'title',
                  cell: (h) => (
                    <Link href={`/orgs/${params.orgId}/bibs/${h.bibliographic_id}`}>
                      <span style={{ fontWeight: 800 }}>{h.bibliographic_title}</span>
                    </Link>
                  ),
                  sortValue: (h) => h.bibliographic_title,
                },
                {
                  id: 'item',
                  header: 'item',
                  cell: (h) =>
                    h.assigned_item_id && h.assigned_item_barcode ? (
                      <Link href={`/orgs/${params.orgId}/items/${h.assigned_item_id}`}>{h.assigned_item_barcode}</Link>
                    ) : h.assigned_item_barcode ? (
                      <span>{h.assigned_item_barcode}</span>
                    ) : (
                      <span className="muted">—</span>
                    ),
                  sortValue: (h) => h.assigned_item_barcode ?? '',
                  width: 160,
                },
                {
                  id: 'ready_until',
                  header: 'ready_until',
                  cell: (h) => <code>{h.ready_until ?? '—'}</code>,
                  sortValue: (h) => h.ready_until ?? '',
                  width: 210,
                },
                {
                  id: 'pickup',
                  header: 'pickup',
                  cell: (h) => (
                    <span className="muted">
                      {h.pickup_location_name} ({h.pickup_location_code})
                    </span>
                  ),
                  sortValue: (h) => `${h.pickup_location_code} ${h.pickup_location_name}`,
                  width: 220,
                },
                {
                  id: 'hold_id',
                  header: 'hold_id',
                  cell: (h) => <code>{h.id}</code>,
                  sortValue: (h) => h.id,
                  width: 310,
                },
              ]}
            />
          )}
        </section>
      ) : null}

      {applying && !applyResult ? (
        <section className="panel">
          <SectionHeader title="Apply 結果" />
          <SkeletonTable columns={6} rows={6} />
        </section>
      ) : null}

      {applyResult ? (
        <section className="panel">
          <SectionHeader title="Apply 結果" />
          <Alert variant="info" title="Apply 摘要" role="status">
            as_of=<code>{applyResult.as_of}</code> · candidates_total=<code>{applyResult.summary.candidates_total}</code> ·
            processed=<code>{applyResult.summary.processed}</code> · transferred=<code>{applyResult.summary.transferred}</code> ·
            released=<code>{applyResult.summary.released}</code> · skipped_item_action=
            <code>{applyResult.summary.skipped_item_action}</code>
          </Alert>

          <p className="muted" style={{ marginTop: 12 }}>
            你可以到 <Link href={`/orgs/${params.orgId}/holds`}>Holds 工作台</Link>（status=ready/queued/expired）確認結果，
            或到 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 查 action <code>hold.expire</code>。
          </p>

          {applyResult.results.length === 0 ? (
            <EmptyState
              title="本次沒有處理任何 holds"
              description="可能已被其他人 fulfill/cancel，或被鎖住而 SKIP LOCKED。"
            />
          ) : (
            <DataTable
              rows={applyResult.results}
              getRowKey={(r) => r.audit_event_id}
              initialSort={{ columnId: 'rank', direction: 'asc' }}
              sortHint="Apply 結果一次載入；排序會即時套用在目前結果。"
              columns={[
                {
                  id: 'rank',
                  header: '#',
                  cell: (r) => <code>{applyRankByAuditEventId.get(r.audit_event_id) ?? '—'}</code>,
                  sortValue: (r) => applyRankByAuditEventId.get(r.audit_event_id) ?? 0,
                  align: 'right',
                  width: 90,
                },
                {
                  id: 'hold_id',
                  header: 'hold_id',
                  cell: (r) => <code>{r.hold_id}</code>,
                  sortValue: (r) => r.hold_id,
                  width: 310,
                },
                {
                  id: 'item_barcode',
                  header: 'item_barcode',
                  cell: (r) => <span className="muted">{r.assigned_item_barcode ?? '—'}</span>,
                  sortValue: (r) => r.assigned_item_barcode ?? '',
                  width: 170,
                },
                {
                  id: 'item_before',
                  header: 'item_before',
                  cell: (r) => <code>{r.item_status_before ?? '—'}</code>,
                  sortValue: (r) => r.item_status_before ?? '',
                  width: 140,
                },
                {
                  id: 'item_after',
                  header: 'item_after',
                  cell: (r) => <code>{r.item_status_after ?? '—'}</code>,
                  sortValue: (r) => r.item_status_after ?? '',
                  width: 140,
                },
                {
                  id: 'transferred_to_hold_id',
                  header: 'transferred_to_hold_id',
                  cell: (r) => (r.transferred_to_hold_id ? <code>{r.transferred_to_hold_id}</code> : <span className="muted">—</span>),
                  sortValue: (r) => r.transferred_to_hold_id ?? '',
                  width: 310,
                },
                {
                  id: 'audit_event_id',
                  header: 'audit_event_id',
                  cell: (r) => <code>{r.audit_event_id}</code>,
                  sortValue: (r) => r.audit_event_id,
                  width: 310,
                },
              ]}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
