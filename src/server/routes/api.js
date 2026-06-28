'use strict';
/**
 * API handlers. Each one: (ctx, engine, req, res, helpers).
 * helpers: { sendJson, readJson, sendBuffer }
 * Routes /v1/* and /api/* are protected with the api key (see server.js).
 */
module.exports = {
  'GET /health': async (ctx, engine, req, res, h) => {
    const up = await engine.isUp();
    h.sendJson(res, 200, { ok: true, daemon: ctx.brand.code, engine: up ? 'up' : 'down' });
  },

  // OpenAI-compatible: generate audio (wav)
  'POST /v1/audio/speech': async (ctx, engine, req, res, h) => {
    const body = await h.readJson(req);
    if (!body.input && !body.text) return h.sendJson(res, 400, { error: "missing 'input'" });
    if (!(await engine.isUp())) {
      if (ctx.config.get('engine.autostart')) await engine.start();
      else return h.sendJson(res, 503, { error: 'engine is down' });
    }
    const { buffer, contentType } = await engine.bridge.speak(body);
    res.writeHead(200, { 'content-type': contentType || 'audio/wav', 'content-length': buffer.length });
    res.end(buffer);
  },

  'GET /v1/models': async (ctx, engine, req, res, h) => {
    if (!(await engine.isUp())) return h.sendJson(res, 503, { error: 'engine is down' });
    h.sendJson(res, 200, await engine.bridge.listModels());
  },

  // model install status (for the panel)
  'GET /api/models': async (ctx, engine, req, res, h) => {
    const { listModels } = require('../../core/modelStatus');
    let inMemory = [];
    if (await engine.isUp()) {
      try {
        const m = await engine.bridge.listModels();
        inMemory = (m.data || []).map((x) => x.id);
      } catch {
        /* ignore */
      }
    }
    h.sendJson(res, 200, { models: listModels(ctx.config.all(), ctx.paths.modelsDir, inMemory) });
  },

  // --- management (panel) ---
  'GET /api/status': async (ctx, engine, req, res, h) => {
    const cfg = ctx.config.all();
    h.sendJson(res, 200, {
      brand: ctx.brand.displayName,
      host: cfg.host,
      port: cfg.port,
      protected: !!cfg.apiKey,
      engine: { backend: cfg.engine.backend, up: await engine.isUp() },
      models: cfg.models,
      tts: cfg.tts,
    });
  },

  'GET /api/config': async (ctx, engine, req, res, h) => {
    const cfg = JSON.parse(JSON.stringify(ctx.config.all()));
    if (cfg.apiKey) cfg.apiKey = '***'; // never expose the key
    if (cfg.hf) cfg.hf.token = cfg.hf.token ? '***' : null;
    h.sendJson(res, 200, cfg);
  },

  'POST /api/config': async (ctx, engine, req, res, h) => {
    const patch = await h.readJson(req); // { "tts.temperature": 0.6, ... }
    for (const [k, v] of Object.entries(patch)) {
      if (v === '***') continue; // masked value, leave it
      ctx.config.set(k, v);
    }
    ctx.config.save();
    h.sendJson(res, 200, { ok: true });
  },

  'POST /api/engine/restart': async (ctx, engine, req, res, h) => {
    await engine.restart();
    h.sendJson(res, 200, { ok: true });
  },
};
