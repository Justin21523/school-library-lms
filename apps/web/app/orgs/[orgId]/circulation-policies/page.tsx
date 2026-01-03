/**
 * Circulation Policies Page（/orgs/:orgId/circulation-policies）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/circulation-policies
 * - POST  /api/v1/orgs/:orgId/circulation-policies
 * - PATCH /api/v1/orgs/:orgId/circulation-policies/:policyId
 *
 * 需求（US-002）：
 * - 可建立 student/teacher 的借閱政策（借期、上限、續借、預約、逾期停權）
 * - 有「有效政策（active/default）」機制，避免只能靠 created_at 最新一筆的隱性規則
 *
 * 本頁採用的治理規則（MVP）：
 * - 同一 org + audience_role 同時只能有一筆 is_active=true（後端用 DB partial unique index 保證）
 * - 建立新政策時，後端會先把同 role 的舊 active 全部設為 inactive，再插入新政策為 active
 *   → 你可以把它視為「建立新版本並立即生效」
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { CirculationPolicy } from '../../../lib/api';
import { createPolicy, listPolicies, updatePolicy } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { Alert } from '../../../components/ui/alert';

// 把數字欄位從字串轉成 int，並做最基本的檢查（讓錯誤在前端就能被看懂）。
function parseIntField(label: string, value: string) {
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n)) throw new Error(`${label} 必須是整數`);
  return n;
}

export default function CirculationPoliciesPage({ params }: { params: { orgId: string } }) {
  // staff session：circulation policies 屬於 staff 設定主檔，受 StaffAuthGuard 保護。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // policies：目前載入到的政策列表（null 代表尚未載入）。
  const [policies, setPolicies] = useState<CirculationPolicy[] | null>(null);

  // loading/error/success：控制 UI。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ----------------------------
  // 建立 policy（表單）
  // ----------------------------

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [audienceRole, setAudienceRole] = useState<CirculationPolicy['audience_role']>('student');
  const [loanDays, setLoanDays] = useState('14');
  const [maxLoans, setMaxLoans] = useState('5');
  const [maxRenewals, setMaxRenewals] = useState('1');
  const [maxHolds, setMaxHolds] = useState('3');
  const [holdPickupDays, setHoldPickupDays] = useState('3');
  const [overdueBlockDays, setOverdueBlockDays] = useState('7');
  const [creating, setCreating] = useState(false);

  // ----------------------------
  // 編輯/設為有效（PATCH）
  // ----------------------------

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editLoanDays, setEditLoanDays] = useState('14');
  const [editMaxLoans, setEditMaxLoans] = useState('5');
  const [editMaxRenewals, setEditMaxRenewals] = useState('1');
  const [editMaxHolds, setEditMaxHolds] = useState('3');
  const [editHoldPickupDays, setEditHoldPickupDays] = useState('3');
  const [editOverdueBlockDays, setEditOverdueBlockDays] = useState('7');

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await listPolicies(params.orgId);
      setPolicies(result);
    } catch (e) {
      setPolicies(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setError('code 不可為空');
      return;
    }
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      await createPolicy(params.orgId, {
        code: trimmedCode,
        name: trimmedName,
        audience_role: audienceRole,
        loan_days: parseIntField('loan_days', loanDays),
        max_loans: parseIntField('max_loans', maxLoans),
        max_renewals: parseIntField('max_renewals', maxRenewals),
        max_holds: parseIntField('max_holds', maxHolds),
        hold_pickup_days: parseIntField('hold_pickup_days', holdPickupDays),
        overdue_block_days: parseIntField('overdue_block_days', overdueBlockDays),
      });

      // 成功後清空（或保留部分預設值）；MVP 先清空 code/name，數字保留便於連續建立。
      setCode('');
      setName('');
      setSuccess(`已建立政策（role=${audienceRole}），並設為有效（active）`);
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: CirculationPolicy) {
    setEditingId(p.id);
    setEditCode(p.code);
    setEditName(p.name);
    setEditLoanDays(String(p.loan_days));
    setEditMaxLoans(String(p.max_loans));
    setEditMaxRenewals(String(p.max_renewals));
    setEditMaxHolds(String(p.max_holds));
    setEditHoldPickupDays(String(p.hold_pickup_days));
    setEditOverdueBlockDays(String(p.overdue_block_days));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCode('');
    setEditName('');
    setEditLoanDays('14');
    setEditMaxLoans('5');
    setEditMaxRenewals('1');
    setEditMaxHolds('3');
    setEditHoldPickupDays('3');
    setEditOverdueBlockDays('7');
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const p = (policies ?? []).find((x) => x.id === editingId);
    if (!p) {
      setError('找不到要編輯的 policy（請重新整理）');
      return;
    }

    const trimmedCode = editCode.trim();
    const trimmedName = editName.trim();
    if (!trimmedCode) {
      setError('code 不可為空');
      return;
    }
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    const payload: Parameters<typeof updatePolicy>[2] = {};

    if (trimmedCode !== p.code) payload.code = trimmedCode;
    if (trimmedName !== p.name) payload.name = trimmedName;

    const nextLoanDays = parseIntField('loan_days', editLoanDays);
    const nextMaxLoans = parseIntField('max_loans', editMaxLoans);
    const nextMaxRenewals = parseIntField('max_renewals', editMaxRenewals);
    const nextMaxHolds = parseIntField('max_holds', editMaxHolds);
    const nextHoldPickupDays = parseIntField('hold_pickup_days', editHoldPickupDays);
    const nextOverdueBlockDays = parseIntField('overdue_block_days', editOverdueBlockDays);

    if (nextLoanDays !== p.loan_days) payload.loan_days = nextLoanDays;
    if (nextMaxLoans !== p.max_loans) payload.max_loans = nextMaxLoans;
    if (nextMaxRenewals !== p.max_renewals) payload.max_renewals = nextMaxRenewals;
    if (nextMaxHolds !== p.max_holds) payload.max_holds = nextMaxHolds;
    if (nextHoldPickupDays !== p.hold_pickup_days) payload.hold_pickup_days = nextHoldPickupDays;
    if (nextOverdueBlockDays !== p.overdue_block_days) payload.overdue_block_days = nextOverdueBlockDays;

    if (Object.keys(payload).length === 0) {
      setError('沒有任何變更需要儲存');
      return;
    }

    setUpdatingId(editingId);
    setError(null);
    setSuccess(null);
    try {
      await updatePolicy(params.orgId, editingId, payload);
      setSuccess('已更新政策');
      await refresh();
      cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  async function activatePolicy(p: CirculationPolicy) {
    if (p.is_active) return;

    const ok = window.confirm(
      `確認要把「${p.name}（${p.code}）」設為有效政策嗎？\n\n同角色（${p.audience_role}）的其他有效政策將會自動被停用。`,
    );
    if (!ok) return;

    setUpdatingId(p.id);
    setError(null);
    setSuccess(null);
    try {
      await updatePolicy(params.orgId, p.id, { is_active: true });
      setSuccess(`已設為有效：role=${p.audience_role}`);
      await refresh();
      if (editingId === p.id) cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Circulation Policies" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Circulation Policies">
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能管理借閱政策。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="Circulation Policies"
        description={
          <>
            對應 API：<code>GET/POST/PATCH /api/v1/orgs/:orgId/circulation-policies</code>
          </>
        }
      >
        <p className="muted">
          提醒：建立新政策後會<strong>自動</strong>設為有效（active），並停用同角色的舊有效政策（保留做為歷史版本）。
        </p>

        <form onSubmit={onCreate} className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              code（英數/dash；同 org 內唯一）
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：STUDENT_DEFAULT" />
            </label>

            <label>
              name（顯示名稱）
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：學生預設政策" />
            </label>
          </div>

          <label>
            audience_role（政策對象）
            <select
              value={audienceRole}
              onChange={(e) => setAudienceRole(e.target.value as CirculationPolicy['audience_role'])}
            >
              <option value="student">student</option>
              <option value="teacher">teacher</option>
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <label>
              loan_days
              <input type="number" value={loanDays} onChange={(e) => setLoanDays(e.target.value)} />
            </label>
            <label>
              max_loans
              <input type="number" value={maxLoans} onChange={(e) => setMaxLoans(e.target.value)} />
            </label>
            <label>
              max_renewals
              <input type="number" value={maxRenewals} onChange={(e) => setMaxRenewals(e.target.value)} />
            </label>
            <label>
              max_holds
              <input type="number" value={maxHolds} onChange={(e) => setMaxHolds(e.target.value)} />
            </label>
            <label>
              hold_pickup_days
              <input type="number" value={holdPickupDays} onChange={(e) => setHoldPickupDays(e.target.value)} />
            </label>
          </div>

          <label>
            overdue_block_days（逾期達 X 天停權新增借閱；0=不啟用）
            <input type="number" value={overdueBlockDays} onChange={(e) => setOverdueBlockDays(e.target.value)} />
          </label>

          <button type="submit" className="btnPrimary" disabled={creating}>
            {creating ? '建立中…' : '建立 Policy（並設為有效）'}
          </button>
        </form>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert variant="success" title="已完成" role="status">
            {success}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="列表" />
        {loading ? <p className="muted">載入中…</p> : null}

        {!loading && policies && policies.length === 0 ? <p className="muted">目前沒有 policies。</p> : null}

        {!loading && policies && policies.length > 0 ? (
          <ul>
            {policies.map((p) => {
              const isEditing = editingId === p.id;
              const isUpdating = updatingId === p.id;

              return (
                <li key={p.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      <span className="muted">({p.code})</span>
                      <span className="muted">role={p.audience_role}</span>
                      {p.is_active ? <span className="success">active</span> : <span className="muted">inactive</span>}
                    </div>

                    <div className="muted">
                      loan_days={p.loan_days} · max_loans={p.max_loans} · max_renewals={p.max_renewals} · max_holds=
                      {p.max_holds} · hold_pickup_days={p.hold_pickup_days} · overdue_block_days={p.overdue_block_days}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button type="button" className="btnSmall" onClick={() => startEdit(p)} disabled={isUpdating || isEditing}>
                        編輯
                      </button>
                      {!p.is_active ? (
                        <button type="button" className={['btnSmall', 'btnPrimary'].join(' ')} onClick={() => void activatePolicy(p)} disabled={isUpdating}>
                          設為有效
                        </button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <form onSubmit={onSaveEdit} className="stack" style={{ marginTop: 8 }}>
                        <p className="muted">
                          編輯中：policy_id=<code>{p.id}</code>（audience_role=<code>{p.audience_role}</code>）
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            code（英數/dash）
                            <input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                          </label>

                          <label>
                            name
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                          <label>
                            loan_days
                            <input type="number" value={editLoanDays} onChange={(e) => setEditLoanDays(e.target.value)} />
                          </label>
                          <label>
                            max_loans
                            <input type="number" value={editMaxLoans} onChange={(e) => setEditMaxLoans(e.target.value)} />
                          </label>
                          <label>
                            max_renewals
                            <input
                              type="number"
                              value={editMaxRenewals}
                              onChange={(e) => setEditMaxRenewals(e.target.value)}
                            />
                          </label>
                          <label>
                            max_holds
                            <input type="number" value={editMaxHolds} onChange={(e) => setEditMaxHolds(e.target.value)} />
                          </label>
                          <label>
                            hold_pickup_days
                            <input
                              type="number"
                              value={editHoldPickupDays}
                              onChange={(e) => setEditHoldPickupDays(e.target.value)}
                            />
                          </label>
                        </div>

                        <label>
                          overdue_block_days
                          <input
                            type="number"
                            value={editOverdueBlockDays}
                            onChange={(e) => setEditOverdueBlockDays(e.target.value)}
                          />
                        </label>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button type="submit" className="btnPrimary" disabled={updatingId === p.id}>
                            {updatingId === p.id ? '儲存中…' : '儲存'}
                          </button>
                          <button type="button" className="btnSmall" onClick={cancelEdit} disabled={updatingId === p.id}>
                            取消
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
