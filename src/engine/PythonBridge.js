'use strict';
/**
 * Cliente HTTP hacia el worker Python (motor de inferencia).
 * Aísla el transporte: el resto del código no sabe que por debajo hay HTTP.
 */
const http = require('http');

class PythonBridge {
  constructor({ host = '127.0.0.1', port }) {
    this.host = host;
    this.port = port;
  }

  _request(method, path, body, { raw = false, timeout = 600000 } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? Buffer.from(JSON.stringify(body)) : null;
      const req = http.request(
        {
          host: this.host,
          port: this.port,
          path,
          method,
          headers: payload
            ? { 'content-type': 'application/json', 'content-length': payload.length }
            : {},
          timeout,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (res.statusCode >= 400) {
              return reject(new Error(`engine ${res.statusCode}: ${buf.toString('utf8').slice(0, 300)}`));
            }
            if (raw) return resolve({ buffer: buf, contentType: res.headers['content-type'] });
            try {
              resolve(JSON.parse(buf.toString('utf8') || '{}'));
            } catch (e) {
              reject(new Error(`respuesta no-JSON del engine: ${e.message}`));
            }
          });
        }
      );
      req.on('timeout', () => req.destroy(new Error('engine timeout')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  health() {
    return this._request('GET', '/health', null, { timeout: 4000 });
  }

  /** Genera audio. Devuelve { buffer (wav), contentType }. */
  speak(opts) {
    return this._request('POST', '/v1/audio/speech', opts, { raw: true });
  }

  listModels() {
    return this._request('GET', '/v1/models', null, { timeout: 8000 });
  }
}

module.exports = { PythonBridge };
