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

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { ok: true };
  }
}
