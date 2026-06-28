'use strict';
/**
 * Auth por API key. Si config.apiKey está seteada, exige el header
 * Authorization: Bearer <key>  o  x-api-key: <key> en rutas protegidas.
 * Si no hay apiKey, todo abierto (pensado para localhost).
 */
function extractKey(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  return null;
}

/** Devuelve true si pasa; si no, responde 401 y devuelve false. */
function checkAuth(ctx, req, res) {
  const apiKey = ctx.config.get('apiKey');
  if (!apiKey) return true; // sin protección
  if (extractKey(req) === apiKey) return true;
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'unauthorized: api key inválida o faltante' }));
  return false;
}

module.exports = { checkAuth, extractKey };
