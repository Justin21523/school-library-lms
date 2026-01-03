/**
 * DbService（PostgreSQL 連線與交易工具）
 *
 * 這個 service 的目標是：
 * - 提供一個「連線池（Pool）」讓我們能在高併發下重用連線
 * - 提供 `query()` 執行單次 SQL
 * - 提供 `transaction()` 讓多個 SQL 在同一個交易（BEGIN/COMMIT/ROLLBACK）中執行
 *
 * 為什麼需要交易（transaction）？
 * - 借出/歸還這種流程會同時更新多張表
 * - 若只成功一半就會造成資料不一致（例如：loan 建立了但 item 狀態沒更新）
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

type DbContextOptions = {
  /**
   * orgId：多租戶 DB context（Row Level Security）
   *
   * 我們在 DB 端啟用 RLS，並用 `app.org_id` 作為「目前租戶」上下文：
   * - policy：organization_id = app_current_org_id()
   * - 因此在執行任何 org-scoped 查詢前，都必須先設定 app.org_id
   *
   * 注意：
   * - 只有「真的需要 tenant scope」的查詢才需要填 orgId
   * - 例如：GET /api/v1/orgs（列出 organizations）就不需要
   */
  orgId?: string;
};

@Injectable()
export class DbService implements OnModuleDestroy {
  // Pool：PostgreSQL 連線池（建議整個 API 只建立一個 Pool）。
  private readonly pool: Pool;

  constructor() {
    // DATABASE_URL 由 `.env` 或作業系統環境變數提供。
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // 在沒有 DB 連線資訊時，直接 fail-fast。
      throw new Error(
        'Missing required env var: DATABASE_URL（請設定環境變數，或複製 .env.example -> .env 後設定 DATABASE_URL）',
      );
    }

    // 初始化連線池（之後所有 query 都透過 pool 取得連線）。
    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    // NestJS 應用程式關閉時，關閉連線池（釋放資源）。
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
    options: DbContextOptions = {},
  ): Promise<QueryResult<T>> {
    // `pool.query` 會自動向 pool 取得連線並執行查詢，完成後釋放。
    //
    // 但若啟用了 RLS（schema.sql），我們必須在「同一條連線」上先設定 app.org_id，
    // 否則 org-scoped tables（locations/users/bibs/...）會被 policy 擋下。
    if (!options.orgId) {
      return await this.pool.query<T>(sql, params);
    }

    return await this.withOrgClient(options.orgId, async (client) => {
      return await client.query<T>(sql, params);
    });
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // 有些操作（尤其是交易）需要「手動取得同一條連線」來跑多次 query。
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      // 無論成功/失敗都要 release，避免連線耗盡。
      client.release();
    }
  }

  async withOrgClient<T>(orgId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // RLS context：把 orgId 設成 session variable（不是 LOCAL），讓它能跨 statement 生效。
    //
    // 為什麼不用 SET LOCAL？
    // - 有些流程會在同一條連線上手動 BEGIN/ROLLBACK（例如 preview/apply 用 rollback 產出報表）
    // - 若用 LOCAL，當前 statement 結束就會回復，反而不穩定
    //
    // 安全性：
    // - 我們在 finally 一律清空 app.org_id，避免連線被 pool 回收後「殘留上一個 org」造成資料外洩。
    return await this.withClient(async (client) => {
      await client.query(`SELECT set_config('app.org_id', $1, false)`, [orgId]);
      try {
        return await fn(client);
      } finally {
        // best effort：避免因清理失敗而蓋掉原本的例外
        try {
          await client.query(`SELECT set_config('app.org_id', '', false)`);
        } catch {
          // ignore
        }
      }
    });
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // transaction()：把一段多步驟操作包進 BEGIN/COMMIT/ROLLBACK。
    return await this.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async transactionWithOrg<T>(orgId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // 對齊 transaction()，但會先設定 RLS org context。
    return await this.withOrgClient(orgId, async (client) => {
      await client.query('BEGIN');
      try {
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }
}
