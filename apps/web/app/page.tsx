/**
 * Next.js App Router：首頁（/）
 *
 * `app/page.tsx` 對應根路由 `/`。
 *
 * 你回饋目前 UI「文字導航太多」：
 * - 因此這裡把首頁改成「卡片式入口」
 * - 讓使用者一眼就能分辨：後台（Console）與讀者端（OPAC）
 *
 * 注意：
 * - 這裡不依賴 API（避免首次進站就因 API/DB 狀態而顯示大量錯誤）
 * - 詳細功能索引在：/orgs → 選擇 org → /orgs/:orgId/index
 */

import Link from 'next/link';

import { NavIcon } from './components/layout/nav-icons';
import { NavTile } from './components/ui/nav-tile';
import { PageHeader, SectionHeader } from './components/ui/page-header';

export default function HomePage() {
  return (
    <main className="container">
      <div className="stack">
        <PageHeader
          title="國中小學雲端圖書館系統"
          description="以「治理導向」的編目與權威控制為核心：term-based 編目、Thesaurus、MARC 匯入匯出、流通與報表。"
          actions={
            <>
              <Link className="btnSmall btnPrimary" href="/orgs">
                進入後台（Console）
              </Link>
              <Link className="btnSmall" href="/opac">
                讀者端（OPAC）
              </Link>
            </>
          }
        >
          <div className="muted">
            初次導入建議順序：先到 <code>/orgs</code> 建立/選擇 org，再進入 <code>/orgs/:orgId/index</code> 用卡片索引導覽各模組。
          </div>
        </PageHeader>

        <section className="panel">
          <SectionHeader title="入口" description="用卡片式視覺語言快速進入主要分區（避免大量文字連結）。" />
          <div className="tileGrid">
            <NavTile
              href="/orgs"
              icon={<NavIcon id="dashboard" size={20} />}
              title="Web Console（後台）"
              description="編目、權威控制、館藏、流通、報表、系統管理。"
              right={<span className="muted">/orgs</span>}
            />
            <NavTile
              href="/opac"
              icon={<NavIcon id="opac" size={20} />}
              title="OPAC（讀者端）"
              description="查詢/預約/我的借閱與預約（student/teacher 登入）。"
              right={<span className="muted">/opac</span>}
            />
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="規格文件地圖" description="（提示）以下是 repo 內的文件路徑；Web 本身不直接 serve .md。" />
          <div className="grid2">
            <div className="callout">
              <div style={{ fontWeight: 900 }}>規格 / 資料</div>
              <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>
                  <code>README.md</code>
                </li>
                <li>
                  <code>MVP-SPEC.md</code>
                </li>
                <li>
                  <code>DATA-DICTIONARY.md</code>
                </li>
              </ul>
            </div>
            <div className="callout">
              <div style={{ fontWeight: 900 }}>API / DB</div>
              <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>
                  <code>API-DRAFT.md</code>
                </li>
                <li>
                  <code>ARCHITECTURE.md</code>
                </li>
                <li>
                  <code>db/schema.sql</code>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
