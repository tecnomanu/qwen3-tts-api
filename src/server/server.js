'use strict';
/**
 * Servidor HTTP (cero dependencias).
 * - Sirve el panel estático desde src/server/web
 * - Enruta la API (routes/api.js)
 * - Protege /v1/* y /api/* con api key (middleware/auth.js)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { checkAuth } = require('./middleware/auth');
const routes = require('./routes/api');

const WEB_DIR = path.join(__dirname, 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const helpers = {
  sendJson(res, code, obj) {
    const b = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length });
    res.end(b);
  },
  readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const s = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(s ? JSON.parse(s) : {});
        } catch (e) {
          reject(new Error('JSON inválido: ' + e.message));
        }
      });
      req.on('error', reject);
    });
  },
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url.split('?')[0] || '/'));
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(WEB_DIR, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(WEB_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('404');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function startServer(ctx, { engine }) {
  const cfg = ctx.config.all();
  const server = http.createServer(async (req, res) => {
    const pathOnly = (req.url || '/').split('?')[0];
    const key = `${req.method} ${pathOnly}`;
    const handler = routes[key];

    try {
      if (handler) {
        // proteger API (todo menos /health) cuando hay api key
        const isProtected = pathOnly.startsWith('/v1/') || pathOnly.startsWith('/api/');
        if (isProtected && !checkAuth(ctx, req, res)) return;
        await handler(ctx, engine, req, res, helpers);
        return;
      }
      if (req.method === 'GET') return serveStatic(req, res);
      helpers.sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      ctx.logger.error(err.message);
      if (!res.headersSent) helpers.sendJson(res, 500, { error: err.message });
    }
  });

  return new Promise((resolve) => {
    server.listen(cfg.port, cfg.host, () => resolve(server));
  });
}

module.exports = { startServer };
