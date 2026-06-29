'use strict';
/**
 * Model download manager: spawns the Python downloader (download.py via uv) and
 * tracks progress in memory so the panel can poll it. One download at a time.
 */
const { spawn } = require('child_process');
const path = require('path');

let state = { role: null, id: null, status: 'idle', mb: 0, totalMb: 0, error: null };

function current() {
  return state;
}

function parseProgress(chunk) {
  const s = chunk.toString();
  // download.py prints "[bar] NN%  X / Y MB"  (or "downloaded X MB" with no total)
  const m = [...s.matchAll(/([\d.]+)\s*\/\s*([\d.]+)\s*MB/g)].pop();
  if (m) {
    state.mb = Math.round(parseFloat(m[1]));
    state.totalMb = Math.round(parseFloat(m[2]));
    return;
  }
  const d = [...s.matchAll(/downloaded\s+([\d.]+)\s*MB/gi)].pop();
  if (d) state.mb = Math.round(parseFloat(d[1]));
}

function start(ctx, role) {
  if (state.status === 'downloading') return state;
  const cfg = ctx.config.all();
  const id = cfg.models[role] || role;
  const dest = path.join(ctx.paths.modelsDir, id.split('/').pop());
  state = { role, id, status: 'downloading', mb: 0, totalMb: 0, error: null };

  const script = path.join(ctx.paths.pythonDir, 'download.py');
  const proc = spawn('uv', ['run', script, id, dest], {
    env: {
      ...process.env,
      HF_HUB_ENABLE_HF_TRANSFER: cfg.hf.enableHfTransfer ? '1' : '0',
      ...(cfg.hf.token ? { HF_TOKEN: cfg.hf.token } : {}),
    },
  });
  proc.stdout.on('data', parseProgress);
  proc.stderr.on('data', parseProgress);
  proc.on('exit', (code) => {
    state.status = code === 0 ? 'done' : 'error';
    if (code !== 0) state.error = 'download exited ' + code;
    if (code === 0 && state.totalMb) state.mb = state.totalMb;
  });
  proc.on('error', (e) => {
    state.status = 'error';
    state.error = e.message;
  });
  ctx.logger.info(`download started: ${id} -> ${dest}`);
  return state;
}

module.exports = { start, current };
