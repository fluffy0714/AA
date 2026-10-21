import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { catalog, regions } from '../../packages/domain/catalog.js';
import { compareBasket, InputError } from '../../packages/domain/compare.js';
import { createDemoProviders } from '../../providers/demo.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const providers = createDemoProviders();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new InputError('Ожидается application/json.');
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new InputError('Слишком большой запрос.'); }
  try { return JSON.parse(body); } catch { throw new InputError('Некорректный JSON.'); }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { status: 'ok', mode: 'demo' });
      if (url.pathname === '/api/catalog' && req.method === 'GET') return json(res, 200, { products: catalog, regions, mode: 'demo' });
      if (url.pathname === '/api/compare' && req.method === 'POST') return json(res, 200, await compareBasket(await readJson(req), providers));
      if (url.pathname === '/api/checkout' && req.method === 'POST') return json(res, 501, { code: 'INTEGRATION_NOT_CONNECTED', message: 'Оформление недоступно: официальные интеграции ещё не подключены.' });
      if (url.pathname.startsWith('/api/')) return json(res, 404, { message: 'API-маршрут не найден.' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { message: 'Метод не поддерживается.' });
      const routes = {
        '/': 'apps/web/index.html', '/index.html': 'apps/web/index.html', '/app.js': 'apps/web/src/app.js',
        '/styles.css': 'apps/web/src/styles.css', '/art.js': 'apps/web/src/art.js', '/api-client.js': 'apps/web/src/api-client.js',
        '/manifest.webmanifest': 'apps/web/public/manifest.webmanifest', '/icon.svg': 'apps/web/public/icon.svg'
      };
      const relative = routes[url.pathname];
      if (!relative) return json(res, 404, { message: 'Страница не найдена.' });
      const file = resolve(root, relative);
      if (!file.startsWith(root + (root.endsWith(sep) ? '' : sep))) return json(res, 403, { message: 'Нет доступа.' });
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { json(res, error instanceof InputError ? 400 : 500, { message: error instanceof InputError ? error.message : 'Не удалось выполнить запрос.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`АА: http://localhost:${port} (demo)`));
}
