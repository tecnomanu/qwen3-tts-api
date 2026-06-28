'use strict';
/**
 * Shared model install-status logic (used by the CLI and the HTTP API).
 * A model can be: installed (in the qvox models dir), cached (in the HF hub
 * cache, still usable), or not installed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function dirSize(dir) {
  let total = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try {
      total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
    } catch {
      /* ignore */
    }
  }
  return total;
}

/** Status of a single model id. */
function statusOf(id, modelsDir) {
  const localDir = path.join(modelsDir, id.split('/').pop());
  if (fs.existsSync(path.join(localDir, 'model.safetensors'))) {
    return { state: 'installed', size: dirSize(localDir) };
  }
  const hubDir = path.join(
    os.homedir(), '.cache', 'huggingface', 'hub',
    'models--' + id.replace(/\//g, '--')
  );
  if (fs.existsSync(hubDir)) {
    return { state: 'cached', size: dirSize(hubDir) };
  }
  return { state: 'not_installed', size: 0 };
}

/** Build the status list for all configured roles. */
function listModels(cfg, modelsDir, inMemory = []) {
  return ['voicedesign', 'base', 'custom'].map((role) => {
    const id = cfg.models[role];
    const st = statusOf(id, modelsDir);
    const loaded = inMemory.some((x) => x === id || x.endsWith('/' + id.split('/').pop()));
    return { role, id, state: st.state, sizeMB: Math.round(st.size / 1048576), loaded };
  });
}

module.exports = { dirSize, statusOf, listModels };
