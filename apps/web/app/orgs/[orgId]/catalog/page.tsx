'use client';

/**
 * Catalog Hub（/orgs/:orgId/catalog）
 *
 * 目標：把「編目與目錄」從側邊欄的文字連結，收斂成：
 * - 以工作流為中心的卡片/段落（編目、MARC、匯入、維護）
 * - 每個入口都用 tile 呈現（icon + title + 一句摘要）
 */

import Link from 'next/link';

import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { NavTile } from '../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';

export default function CatalogHubPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  return (
    <div className="stack">
      <PageHeader
        title="編目與目錄"
        description="以工作流為中心的導覽：書目編目、MARC 工具、匯入匯出、維護/批次（backfill）。"
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}`}>
              Dashboard
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/index`}>
              功能索引
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              Bibs
            </Link>
          </>
        }
      >
        {!staffReady ? (
          <Alert variant="info" title="載入登入狀態中…" role="status">
            編目/MARC/匯入/維護多數需要 staff 登入。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            你可以先瀏覽此導覽頁，但進入治理/匯入等功能時需要登入。請前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="編目（書目資料）" description="以本系統表單欄位為主（term-based 逐步落地）。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/bibs`}
            icon={<NavIcon id="catalog" size={20} />}
            title="書目查詢 / 編目"
            description="查詢、建立、編修書目；term-based 欄位（subjects/geographic/genre/name）逐步整合。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/import`}
            icon={<NavIcon id="catalog" size={20} />}
            title="Catalog CSV 匯入"
            description="用 CSV 批次建立/更新書目；適合從舊系統遷移基本欄位。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="MARC 21 工具" description="MARC 是交換格式；本系統以 marc_extras 保留未對映欄位。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/bibs/marc-editor`}
            icon={<NavIcon id="marc" size={20} />}
            title="MARC 編輯器"
            description="編輯 marc_extras；下載 .mrc/.xml/.json；支援 authority linking 子欄位。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/marc-dictionary`}
            icon={<NavIcon id="marc" size={20} />}
            title="MARC 欄位字典"
            description="欄位/指標/子欄位一覽 + 搜尋；作為下拉選單與驗證來源。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/import-marc`}
            icon={<NavIcon id="marc" size={20} />}
            title="MARC 匯入（preview/apply）"
            description="支援 .mrc / MARCXML / MARC-in-JSON；未對映欄位保留到 marc_extras。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="維護 / 批次（Backfill）" description="把既有 text[] 回填到 junction table，讓 term-based 真正可落地。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/bibs/maintenance/backfill-subject-terms`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="主題詞 backfill（650）"
            description="subjects(text[]) → bibliographic_subject_terms；輸出 auto-created/ambiguous/unmatched 報表。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/maintenance/backfill-geographic-terms`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="地理名稱 backfill（651）"
            description="geographics(text[]) → bibliographic_geographic_terms；可用 marc_extras 的 651$a 補來源。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/maintenance/backfill-genre-terms`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="類型/體裁 backfill（655）"
            description="genres(text[]) → bibliographic_genre_terms；可用 marc_extras 的 655$a 補來源。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/maintenance/backfill-name-terms`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="人名 linking backfill（100/700）"
            description="creators/contributors(text[]) → bibliographic_name_terms（role + position）。"
          />
        </div>
      </section>
    </div>
  );
}

