/**
 * HTTP helpers（adapter-agnostic）
 *
 * 這個 repo 的 NestJS 目前跑在 Fastify（@nestjs/platform-fastify）上，
 * 但我們希望保留「可切換 HTTP adapter」的彈性。
 *
 * 因此這裡做一個極小的 header 抽象：
 * - FastifyReply：`reply.header(name, value)`
 * - Express Response：`res.setHeader(name, value)`
 * - FastifyReply.raw：Node 原生 `ServerResponse#setHeader`
 */

function setHeaderCompat(res: any, name: string, value: string) {
  if (!res) return;

  if (typeof res.header === 'function') {
    res.header(name, value);
    return;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
    return;
  }

  // FastifyReply.raw：Node 的 ServerResponse（保底）
  if (res.raw && typeof res.raw.setHeader === 'function') {
    res.raw.setHeader(name, value);
  }
}

export function setCsvDownloadHeaders(res: any, filename: string) {
  setHeaderCompat(res, 'content-type', 'text/csv; charset=utf-8');
  setHeaderCompat(res, 'content-disposition', `attachment; filename="${filename}"`);
  setHeaderCompat(res, 'cache-control', 'no-store');
}

