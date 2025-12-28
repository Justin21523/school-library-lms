/**
 * Console Navigation（導覽資訊架構 / IA）
 *
 * 你要求的 UX 方向是「像圖書資訊領域的 taxonomy」：
 * - 不把所有功能平鋪在左側（會變成又長又難掃描的清單）
 * - 改用「階層式分類 → 模組 → 子功能」的導覽樹
 * - Web UI 以這份資料結構當作單一真相來源（single source of truth）
 *
 * 這個檔案只負責「導覽資料」：
 * - 不放 React 元件（避免 server/client 的 boundary 問題）
 * - icon 只用字串代號；實際 SVG 由 UI layer 決定如何呈現
 */

export type NavIconId =
  | 'dashboard'
  | 'catalog'
  | 'marc'
  | 'authority'
  | 'holdings'
  | 'circulation'
  | 'reports'
  | 'admin'
  | 'opac'
  | 'maintenance';

export type OrgConsoleNavItem = {
  type: 'item';
  id: string;
  label: string;
  href: string;
  icon?: NavIconId;
  description?: string;
  keywords?: string[];
};

export type OrgConsoleNavGroup = {
  type: 'group';
  id: string;
  label: string;
  icon?: NavIconId;
  defaultOpen?: boolean;
  children: Array<OrgConsoleNavGroup | OrgConsoleNavItem>;
};

export type OrgConsoleNavNode = OrgConsoleNavGroup | OrgConsoleNavItem;

/**
 * 產生「單一 org 範圍」的導覽樹。
 *
 * 注意：href 一律用 orgId 展開，避免呼叫端重複組路由（也避免拼錯）。
 */
export function getOrgConsoleNav(orgId: string): OrgConsoleNavGroup[] {
  return [
    {
      type: 'group',
      id: 'overview',
      label: '概覽',
      icon: 'dashboard',
      defaultOpen: true,
      children: [
        {
          type: 'item',
          id: 'dashboard',
          label: 'Dashboard',
          href: `/orgs/${orgId}`,
          icon: 'dashboard',
          keywords: ['overview', 'home', '總覽', '概覽', 'dashboard'],
        },
      ],
    },

    // ----
    // 編目 / 目錄：metadata、MARC、匯入匯出、編修
    // ----
    {
      type: 'group',
      id: 'cataloging',
      label: '編目與目錄',
      icon: 'catalog',
      defaultOpen: true,
      children: [
        {
          type: 'item',
          id: 'bibs',
          label: '書目（Bibs）',
          href: `/orgs/${orgId}/bibs`,
          icon: 'catalog',
          description: '書目查詢 / 建立 / term-based 編目',
          keywords: ['bibs', 'catalog', '書目', '編目', 'metadata'],
        },
        {
          type: 'group',
          id: 'marc',
          label: 'MARC 21',
          icon: 'marc',
          defaultOpen: true,
          children: [
            {
              type: 'item',
              id: 'marc-editor',
              label: 'MARC 編輯器',
              href: `/orgs/${orgId}/bibs/marc-editor`,
              icon: 'marc',
              keywords: ['marc', 'editor', '編輯器', '008', '006'],
            },
            {
              type: 'item',
              id: 'marc-import',
              label: 'MARC 匯入',
              href: `/orgs/${orgId}/bibs/import-marc`,
              icon: 'marc',
              keywords: ['marc', 'import', '匯入'],
            },
            {
              type: 'item',
              id: 'marc-dictionary',
              label: '欄位字典',
              href: `/orgs/${orgId}/bibs/marc-dictionary`,
              icon: 'marc',
              keywords: ['marc', 'dictionary', '欄位', '指標', '子欄位', 'validation', '驗證'],
            },
          ],
        },
        {
          type: 'item',
          id: 'catalog-import',
          label: '書目 CSV 匯入（Catalog Import）',
          href: `/orgs/${orgId}/bibs/import`,
          icon: 'catalog',
          keywords: ['csv', 'import', '匯入', 'catalog'],
        },
        {
          type: 'group',
          id: 'catalog-maintenance',
          label: '維護工具（Backfill / Maintenance）',
          icon: 'maintenance',
          defaultOpen: false,
          children: [
            {
              type: 'item',
              id: 'backfill-subject-terms',
              label: 'Backfill：主題詞（650）',
              href: `/orgs/${orgId}/bibs/maintenance/backfill-subject-terms`,
              icon: 'maintenance',
              keywords: ['backfill', 'subject', '650', 'thesaurus'],
            },
            {
              type: 'item',
              id: 'backfill-geographic-terms',
              label: 'Backfill：地理名稱（651）',
              href: `/orgs/${orgId}/bibs/maintenance/backfill-geographic-terms`,
              icon: 'maintenance',
              keywords: ['backfill', 'geographic', '651'],
            },
            {
              type: 'item',
              id: 'backfill-genre-terms',
              label: 'Backfill：類型/體裁（655）',
              href: `/orgs/${orgId}/bibs/maintenance/backfill-genre-terms`,
              icon: 'maintenance',
              keywords: ['backfill', 'genre', '655'],
            },
            {
              type: 'item',
              id: 'backfill-name-terms',
              label: 'Backfill：人名（100/700）',
              href: `/orgs/${orgId}/bibs/maintenance/backfill-name-terms`,
              icon: 'maintenance',
              keywords: ['backfill', 'name', '100', '700'],
            },
          ],
        },
      ],
    },

    // ----
    // 權威控制：主檔 + thesaurus + 治理
    // ----
    {
      type: 'group',
      id: 'authority',
      label: '權威控制（Authority Control）',
      icon: 'authority',
      defaultOpen: true,
      children: [
        {
          type: 'item',
          id: 'authority-home',
          label: '主控入口（治理主頁）',
          href: `/orgs/${orgId}/authority`,
          icon: 'authority',
          keywords: ['authority', 'control', '治理', '主控'],
        },
        {
          type: 'item',
          id: 'authority-terms',
          label: '權威詞主檔（Terms）',
          href: `/orgs/${orgId}/authority-terms`,
          icon: 'authority',
          keywords: ['authority', 'terms', '主檔', 'controlled vocabulary'],
        },
        {
          type: 'group',
          id: 'thesaurus',
          label: 'Thesaurus（樹/關係）',
          icon: 'authority',
          defaultOpen: true,
          children: [
            {
              type: 'item',
              id: 'thesaurus-browser',
              label: '瀏覽/搜尋',
              href: `/orgs/${orgId}/authority-terms/thesaurus`,
              icon: 'authority',
              keywords: ['thesaurus', 'browse', 'search', '主題詞樹'],
            },
            {
              type: 'item',
              id: 'thesaurus-quality',
              label: '品質檢查（Quality）',
              href: `/orgs/${orgId}/authority-terms/thesaurus/quality`,
              icon: 'authority',
              keywords: ['thesaurus', 'quality', '治理', 'lint'],
            },
            {
              type: 'item',
              id: 'thesaurus-visual',
              label: '視覺化編輯器（Visual）',
              href: `/orgs/${orgId}/authority-terms/thesaurus/visual`,
              icon: 'authority',
              keywords: ['thesaurus', 'visual', 'graph', 'editor', '拖拉', 're-parent', 'merge'],
            },
          ],
        },
      ],
    },

    // ----
    // 館藏 / 典藏：items、locations、inventory
    // ----
    {
      type: 'group',
      id: 'holdings',
      label: '館藏管理',
      icon: 'holdings',
      defaultOpen: false,
      children: [
        {
          type: 'item',
          id: 'items',
          label: '冊（Items）',
          href: `/orgs/${orgId}/items`,
          icon: 'holdings',
          keywords: ['items', 'copies', '冊', '館藏'],
        },
        {
          type: 'item',
          id: 'inventory',
          label: '盤點（Inventory）',
          href: `/orgs/${orgId}/inventory`,
          icon: 'holdings',
          keywords: ['inventory', '盤點'],
        },
        {
          type: 'item',
          id: 'locations',
          label: '館藏地點（Locations）',
          href: `/orgs/${orgId}/locations`,
          icon: 'holdings',
          keywords: ['locations', '館藏地點', '書架', '館別'],
        },
      ],
    },

    // ----
    // 流通：借閱/預約/政策/櫃台
    // ----
    {
      type: 'group',
      id: 'circulation',
      label: '流通服務',
      icon: 'circulation',
      defaultOpen: true,
      children: [
        {
          type: 'item',
          id: 'circulation-desk',
          label: '流通櫃台（Circulation）',
          href: `/orgs/${orgId}/circulation`,
          icon: 'circulation',
          keywords: ['circulation', 'desk', '櫃台'],
        },
        {
          type: 'item',
          id: 'loans',
          label: '借閱（Loans）',
          href: `/orgs/${orgId}/loans`,
          icon: 'circulation',
          keywords: ['loans', '借閱'],
        },
        {
          type: 'item',
          id: 'holds',
          label: '預約（Holds）',
          href: `/orgs/${orgId}/holds`,
          icon: 'circulation',
          keywords: ['holds', '預約'],
        },
        {
          type: 'item',
          id: 'policies',
          label: '流通政策（Policies）',
          href: `/orgs/${orgId}/circulation-policies`,
          icon: 'circulation',
          keywords: ['policies', 'circulation policies', 'policy', '規則'],
        },
        {
          type: 'group',
          id: 'circulation-maintenance',
          label: '維護（Maintenance）',
          icon: 'maintenance',
          defaultOpen: false,
          children: [
            {
              type: 'item',
              id: 'holds-maintenance',
              label: 'Holds Maintenance',
              href: `/orgs/${orgId}/holds/maintenance`,
              icon: 'maintenance',
              keywords: ['holds', 'maintenance'],
            },
            {
              type: 'item',
              id: 'loans-maintenance',
              label: 'Loans Maintenance',
              href: `/orgs/${orgId}/loans/maintenance`,
              icon: 'maintenance',
              keywords: ['loans', 'maintenance'],
            },
          ],
        },
      ],
    },

    // ----
    // 報表：各類分析/統計
    // ----
    {
      type: 'group',
      id: 'reports',
      label: '報表與分析',
      icon: 'reports',
      defaultOpen: false,
      children: [
        {
          type: 'item',
          id: 'report-overdue',
          label: '逾期清單（Overdue）',
          href: `/orgs/${orgId}/reports/overdue`,
          icon: 'reports',
          keywords: ['report', 'overdue', '逾期'],
        },
        {
          type: 'item',
          id: 'report-ready-holds',
          label: '可取書預約（Ready Holds）',
          href: `/orgs/${orgId}/reports/ready-holds`,
          icon: 'reports',
          keywords: ['report', 'holds', 'ready'],
        },
        {
          type: 'item',
          id: 'report-top-circulation',
          label: '熱門借閱（Top Circulation）',
          href: `/orgs/${orgId}/reports/top-circulation`,
          icon: 'reports',
          keywords: ['report', 'top', 'circulation'],
        },
        {
          type: 'item',
          id: 'report-circulation-summary',
          label: '流通摘要（Summary）',
          href: `/orgs/${orgId}/reports/circulation-summary`,
          icon: 'reports',
          keywords: ['report', 'summary', 'circulation'],
        },
        {
          type: 'item',
          id: 'report-zero-circulation',
          label: '零借閱（Zero Circulation）',
          href: `/orgs/${orgId}/reports/zero-circulation`,
          icon: 'reports',
          keywords: ['report', 'zero', 'circulation'],
        },
      ],
    },

    // ----
    // 系統管理：帳號、稽核、啟用流程
    // ----
    {
      type: 'group',
      id: 'admin',
      label: '系統管理',
      icon: 'admin',
      defaultOpen: false,
      children: [
        {
          type: 'item',
          id: 'users',
          label: '使用者（Users）',
          href: `/orgs/${orgId}/users`,
          icon: 'admin',
          keywords: ['users', 'staff', 'accounts', '使用者'],
        },
        {
          type: 'item',
          id: 'users-import',
          label: '使用者 CSV 匯入',
          href: `/orgs/${orgId}/users/import`,
          icon: 'admin',
          keywords: ['users', 'csv', 'import', '匯入'],
        },
        {
          type: 'item',
          id: 'bootstrap-set-password',
          label: 'Bootstrap：設定初始密碼',
          href: `/orgs/${orgId}/bootstrap-set-password`,
          icon: 'admin',
          keywords: ['bootstrap', 'password', 'admin'],
        },
        {
          type: 'item',
          id: 'audit-events',
          label: '稽核事件（Audit）',
          href: `/orgs/${orgId}/audit-events`,
          icon: 'admin',
          keywords: ['audit', 'events', '稽核'],
        },
      ],
    },

    // ----
    // OPAC（讀者端）：同 org 的讀者入口，方便 staff 快速切換/驗證
    // ----
    {
      type: 'group',
      id: 'opac',
      label: '讀者端（OPAC）',
      icon: 'opac',
      defaultOpen: false,
      children: [
        {
          type: 'item',
          id: 'opac-home',
          label: 'OPAC：搜尋與預約',
          href: `/opac/orgs/${orgId}`,
          icon: 'opac',
          keywords: ['opac', 'search', 'holds', '讀者端'],
        },
        {
          type: 'item',
          id: 'opac-login',
          label: 'OPAC：登入',
          href: `/opac/orgs/${orgId}/login`,
          icon: 'opac',
          keywords: ['opac', 'login'],
        },
        {
          type: 'item',
          id: 'opac-loans',
          label: 'OPAC：我的借閱',
          href: `/opac/orgs/${orgId}/loans`,
          icon: 'opac',
          keywords: ['opac', 'loans', '我的借閱'],
        },
        {
          type: 'item',
          id: 'opac-holds',
          label: 'OPAC：我的預約',
          href: `/opac/orgs/${orgId}/holds`,
          icon: 'opac',
          keywords: ['opac', 'holds', '我的預約'],
        },
      ],
    },
  ];
}

/**
 * 把樹狀 nav 壓平成「可搜尋/可快速跳轉」的一維清單。
 * - 用於 command palette / sidebar search
 */
export function flattenOrgConsoleNav(nodes: OrgConsoleNavNode[]): OrgConsoleNavItem[] {
  const items: OrgConsoleNavItem[] = [];
  for (const node of nodes) {
    if (node.type === 'item') {
      items.push(node);
      continue;
    }
    items.push(...flattenOrgConsoleNav(node.children));
  }
  return items;
}

