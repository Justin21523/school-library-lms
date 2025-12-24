/**
 * Circulation Policies Page（/orgs/:orgId/circulation-policies）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/circulation-policies
 * - POST /api/v1/orgs/:orgId/circulation-policies
 *
 * 借還（checkout）會依 borrower.role 找到對應 policy：
 * - student / teacher 的 loan_days / max_loans 等規則都在這裡設定
 */

// 需要載入列表與表單互動，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { CirculationPolicy } from '../../../lib/api';
import { createPolicy, listPolicies } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function CirculationPoliciesPage({ params }: { params: { orgId: string } }) {
  // staff session：circulation policies 屬於 staff 設定主檔，受 StaffAuthGuard 保護。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // policies：目前載入到的政策列表（null 代表尚未載入）。
  const [policies, setPolicies] = useState<CirculationPolicy[] | null>(null);

  // loading/error：控制 UI。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 建立 policy 表單欄位（用 string 方便與 <input type="number"> 互動）。
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [audienceRole, setAudienceRole] = useState<CirculationPolicy['audience_role']>('student');
  const [loanDays, setLoanDays] = useState('14');
  const [maxLoans, setMaxLoans] = useState('5');
  const [maxRenewals, setMaxRenewals] = useState('1');
  const [maxHolds, setMaxHolds] = useState('3');
  const [holdPickupDays, setHoldPickupDays] = useState('3');
  const [creating, setCreating] = useState(false);

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

  // 把數字欄位從字串轉成 int，並做最基本的檢查。
  function parseIntField(label: string, value: string) {
    const n = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(n)) throw new Error(`${label} 必須是整數`);
    return n;
  }

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
      });

      // 成功後清空（或保留部分預設值）；MVP 先清空 code/name，數字保留便於連續建立。
      setCode('');
      setName('');
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Circulation Policies</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Circulation Policies</h1>
          <p className="error">
            這頁需要 staff 登入才能管理借閱政策。請先前往{' '}
            <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Circulation Policies</h1>
        <p className="muted">
          對應 API：<code>GET/POST /api/v1/orgs/:orgId/circulation-policies</code>
        </p>

        <form onSubmit={onCreate} className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              code（小寫/數字/dash；同 org 內唯一）
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：student-default" />
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

          <button type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立 Policy'}
          </button>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>列表</h2>
        {loading ? <p className="muted">載入中…</p> : null}

        {!loading && policies && policies.length === 0 ? (
          <p className="muted">目前沒有 policies。</p>
        ) : null}

        {!loading && policies && policies.length > 0 ? (
          <ul>
            {policies.map((p) => (
              <li key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>{' '}
                    <span className="muted">({p.code})</span>
                  </div>
                  <div className="muted">
                    role={p.audience_role} · loan_days={p.loan_days} · max_loans={p.max_loans} ·
                    max_renewals={p.max_renewals} · max_holds={p.max_holds} · hold_pickup_days=
                    {p.hold_pickup_days}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
