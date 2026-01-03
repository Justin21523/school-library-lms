/**
 * MARC21 Field Dictionary（Web wrapper）
 *
 * 背景：
 * - Web 與 API 若各自維護 MARC21 字典，久了必然漂移（drift）。
 * - 使用者會遇到「前端看得到/填得進去，但後端拒絕」或「匯入後端可存，但前端字典頁/下拉看不到」。
 *
 * 決策：
 * - 字典/驗證邏輯集中到 `@library-system/shared`（單一真相來源）
 * - 本檔保留原 import 路徑，避免需要大規模搬移所有 imports（增量改動）
 */

export * from '@library-system/shared';

