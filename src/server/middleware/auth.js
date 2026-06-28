'use strict';
/**
 * API key auth. If config.apiKey is set, require the header
 * Authorization: Bearer <key>  or  x-api-key: <key>  on protected routes.
 * If no apiKey is set, everything is open (intended for localhost).
 */
function extractKey(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  return null;
}

/** Returns true if allowed; otherwise responds 401 and returns false. */
function checkAuth(ctx, req, res) {
  const apiKey = ctx.config.get('apiKey');
  if (!apiKey) return true; // unprotected
  if (extractKey(req) === apiKey) return true;
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'unauthorized: invalid or missing api key' }));
  return false;
}

module.exports = { checkAuth, extractKey };
