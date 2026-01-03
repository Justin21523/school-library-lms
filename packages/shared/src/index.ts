/**
 * shared package
 *
 * 這個套件預計放「前後端共用」的型別與小工具，避免：
 * - Web 認為 UserId 是 number，API 認為是 string
 * - API 回傳欄位改名，Web 沒同步更新
 *
 * 目前先只放 ID 型別別名（type alias），讓你在程式碼中更容易辨識語意。
 */

export type OrganizationId = string;
export type UserId = string;
export type BibliographicId = string;
export type ItemId = string;
export type LoanId = string;
export type HoldId = string;

export * from './marc21-authority-linking';
export * from './marc21-bib-field-dictionary';
