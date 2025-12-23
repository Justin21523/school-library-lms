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
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DbService implements OnModuleDestroy {
  // Pool：PostgreSQL 連線池（建議整個 API 只建立一個 Pool）。
  private readonly pool: Pool;

  constructor() {
    // DATABASE_URL 由 `.env` 或作業系統環境變數提供。
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // 在沒有 DB 連線資訊時，直接 fail-fast。
      throw new Error('Missing required env var: DATABASE_URL');
    }

    // 初始化連線池（之後所有 query 都透過 pool 取得連線）。
    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    // NestJS 應用程式關閉時，關閉連線池（釋放資源）。
    await this.pool.end();
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    // `pool.query` 會自動向 pool 取得連線並執行查詢，完成後釋放。
    return await this.pool.query<T>(sql, params);
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
}
