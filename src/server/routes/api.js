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
    const { buffer, contentType, headers } = await engine.bridge.speak(body);
    const out = { 'content-type': contentType || 'audio/wav', 'content-length': buffer.length };
    for (const [k, v] of Object.entries(headers || {})) {
      if (k.toLowerCase().startsWith('x-qvox-')) out[k] = v; // timing metadata for the panel
    }
    res.writeHead(200, out);
    res.end(buffer);
  },

  // Same body as /v1/audio/speech, but the audio comes back as it is made:
  // 16-bit little-endian mono PCM, no header, chunked. The sample rate rides in
  // X-QVox-Sample-Rate because a raw stream has nowhere else to put it.
  //
  // The wait for speech was never the audio, it was waiting for all of it: the
  // same line answers in ~3.5 s through /v1/audio/speech and puts its first
  // chunk on the wire at ~350 ms here. Nothing is buffered on the way through —
  // buffering would give back the very latency the route exists to remove.
  'POST /v1/audio/speech/stream': async (ctx, engine, req, res, h) => {
    const body = await h.readJson(req);
    if (!body.input && !body.text) return h.sendJson(res, 400, { error: "missing 'input'" });
    if (!(await engine.isUp())) {
      if (ctx.config.get('engine.autostart')) await engine.start();
      else return h.sendJson(res, 503, { error: 'engine is down' });
    }
    try {
      const upstream = await engine.bridge.speakStream(body);
      if (upstream.statusCode !== 200) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        res.writeHead(upstream.statusCode, { 'content-type': 'application/json' });
        return res.end(Buffer.concat(chunks));
      }
      const out = { 'content-type': upstream.headers['content-type'] || 'audio/L16' };
      for (const [k, v] of Object.entries(upstream.headers)) {
        if (k.toLowerCase().startsWith('x-qvox-')) out[k] = v;
      }
      res.writeHead(200, out);
      upstream.pipe(res);
      // A client that hangs up mid-sentence should not leave the engine writing
      // into a dead socket.
      res.on('close', () => upstream.destroy());
    } catch (e) {
      if (!res.headersSent) h.sendJson(res, 500, { error: e.message });
      else res.end();
    }
  },

  // Warm the model without generating anything a caller has to keep. Autostarts
  // the engine like the speech route does, so a client can call this first and
  // pay the whole cold path — process start plus decompression — up front.
  'POST /v1/warmup': async (ctx, engine, req, res, h) => {
    const body = await h.readJson(req).catch(() => ({}));
    if (!(await engine.isUp())) {
      if (ctx.config.get('engine.autostart')) await engine.start();
      else return h.sendJson(res, 503, { error: 'engine is down' });
    }
    try {
      // Forward the body: it carries which speaker to warm, and warming the
      // wrong one costs the caller a full model load on its next request —
      // exactly the cost warmup exists to avoid.
      h.sendJson(res, 200, await engine.bridge.warmup(body));
    } catch (e) {
      h.sendJson(res, 500, { ok: false, error: e.message });
    }
  },

  'GET /v1/models': async (ctx, engine, req, res, h) => {
    if (!(await engine.isUp())) return h.sendJson(res, 503, { error: 'engine is down' });
    h.sendJson(res, 200, await engine.bridge.listModels());
  },

  'GET /v1/voices': async (ctx, engine, req, res, h) => {
    if (!(await engine.isUp())) return h.sendJson(res, 200, { voices: [] });
    try {
      h.sendJson(res, 200, await engine.bridge.listVoices());
    } catch {
      h.sendJson(res, 200, { voices: [] });
    }
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
      version: require('../../../package.json').version,
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

  'POST /api/models/download': async (ctx, engine, req, res, h) => {
    const downloads = require('../../core/downloads');
    const { role } = await h.readJson(req);
    if (!role) return h.sendJson(res, 400, { error: 'missing role' });
    h.sendJson(res, 200, downloads.start(ctx, role));
  },

  'GET /api/models/download': async (ctx, engine, req, res, h) => {
    const downloads = require('../../core/downloads');
    h.sendJson(res, 200, downloads.current());
  },
};
