/**
 * Next.js App Router：首頁（/）
 *
 * `app/page.tsx` 對應根路由 `/`。
 * 目前只放一個「提示頁」，告訴你倉庫的重點文件在哪裡。
 */

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto'}}>
      <h1>國中小學雲端圖書館系統</h1>
      <p>目前此倉庫以規格與文件為主；開發草案請看根目錄的 `README.md`、`MVP-SPEC.md`、`API-DRAFT.md`。</p>
    </main>
  );
}
