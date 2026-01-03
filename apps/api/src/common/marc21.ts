/**
 * MARC21 Field Dictionary（API wrapper）
 *
 * 背景：
 * - 原本 Web 與 API 各自維護一份「常用 MARC21（BIB）欄位字典」。
 * - 這會造成長期漂移：同一個 tag 在 UI 可選，但 API 驗證拒絕（或反過來）。
 *
 * 決策：
 * - 字典/驗證的單一真相來源（SSOT）移到 `@library-system/shared`
 * - 本檔保留「原本的 import 路徑」，避免大量檔案需要改 import（增量、可 review）
 */

export * from '@library-system/shared';

