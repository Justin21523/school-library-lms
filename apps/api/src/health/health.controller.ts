/**
 * HealthController
 *
 * 這是一個「健康檢查」端點：
 * - 用於確認 API 程式是否成功啟動
 * - 常用於 Docker/K8s 的 health check / readiness probe
 *
 * 目前回傳 `{ ok: true }` 就代表服務在跑。
 */

import { Controller, Get } from '@nestjs/common';

import { DbService } from '../db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get()
  async getHealth() {
    // 注意：health endpoint 的首要目的，是確認「API process 有跑」。
    // 但現場除錯時，最常見的第二層問題是「DB 沒起/連不到」。
    //
    // 因此我們在不影響 200 回應的前提下，回傳 db 探測結果：
    // - db.ok=true 代表 DB 可連線且可 query
    // - db.ok=false 代表 DB 有問題（例如連線拒絕/帳密錯誤/還沒啟動）
    try {
      // DB probe 要「快」：避免 DB 掛掉時 /health 自己也卡死，反而讓除錯更困難。
      // - 這裡用 Promise.race 做一個最小 timeout（不追求完美取消，只求 health 能快速回應）
      await Promise.race([
        this.db.query('select 1 as ok'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB probe timeout')), 800)),
      ]);

      // schema probe：確認「常用功能」所需的 tables/columns 是否存在
      // - 不做 migrations，只做偵測（讓你在 Web UI 一眼看到根因）
      // - schema 缺漏時，API 仍會跑，但許多頁面會 500（undefined_table/undefined_column）
      const schema = await this.probeSchema();

      return { ok: true, db: { ok: true }, schema };
    } catch (e) {
      return {
        ok: true,
        db: {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
        schema: { ok: null, error: 'DB down; schema probe skipped' },
      };
    }
  }

  private async probeSchema(): Promise<
    | { ok: true; missing: string[] }
    | { ok: false; missing: string[]; hint: string }
    | { ok: null; error: string }
  > {
    try {
      const result = await Promise.race([
        this.db.query<{
          has_authority_terms: boolean;
          has_bib_subject_terms: boolean;
          has_bib_geographic_terms: boolean;
          has_bib_genre_terms: boolean;
          has_bib_name_terms: boolean;
          has_bibs_geographics: boolean;
          has_bibs_genres: boolean;
        }>(
          `
          select
            (to_regclass('public.authority_terms') is not null) as has_authority_terms,
            (to_regclass('public.bibliographic_subject_terms') is not null) as has_bib_subject_terms,
            (to_regclass('public.bibliographic_geographic_terms') is not null) as has_bib_geographic_terms,
            (to_regclass('public.bibliographic_genre_terms') is not null) as has_bib_genre_terms,
            (to_regclass('public.bibliographic_name_terms') is not null) as has_bib_name_terms,
            exists (
              select 1
              from information_schema.columns
              where table_schema='public'
                and table_name='bibliographic_records'
                and column_name='geographics'
            ) as has_bibs_geographics,
            exists (
              select 1
              from information_schema.columns
              where table_schema='public'
                and table_name='bibliographic_records'
                and column_name='genres'
            ) as has_bibs_genres
          `,
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Schema probe timeout')), 800)),
      ]);

      const row = result.rows[0];
      if (!row) return { ok: null, error: 'Schema probe returned no rows' };

      const missing: string[] = [];
      if (!row.has_authority_terms) missing.push('authority_terms');
      if (!row.has_bib_subject_terms) missing.push('bibliographic_subject_terms');
      if (!row.has_bib_geographic_terms) missing.push('bibliographic_geographic_terms');
      if (!row.has_bib_genre_terms) missing.push('bibliographic_genre_terms');
      if (!row.has_bib_name_terms) missing.push('bibliographic_name_terms');
      if (!row.has_bibs_geographics) missing.push('bibliographic_records.geographics');
      if (!row.has_bibs_genres) missing.push('bibliographic_records.genres');

      if (missing.length === 0) return { ok: true, missing };

      return {
        ok: false,
        missing,
        hint: '請先套用 db/schema.sql（建議：npm run demo:db:seed；若要清空重建：npm run demo:db:reset）。',
      };
    } catch (e) {
      return { ok: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
