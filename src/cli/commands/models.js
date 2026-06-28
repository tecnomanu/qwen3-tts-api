'use strict';
/** Manage models: list | download <role|id> | remove <name> | path */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { EngineManager } = require('../../engine/EngineManager');

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

/** Resolve install status of a model id, checking the qvox dir and the HF cache. */
function modelStatus(id, modelsDir) {
  // 1) installed in the qvox models dir
  const localDir = path.join(modelsDir, id.split('/').pop());
  if (fs.existsSync(path.join(localDir, 'model.safetensors'))) {
    return { state: 'installed', icon: '✅', size: dirSize(localDir) };
  }
  // 2) present in the HuggingFace hub cache (usable, e.g. by the mlx backend)
  const hubDir = path.join(
    os.homedir(), '.cache', 'huggingface', 'hub',
    'models--' + id.replace(/\//g, '--')
  );
  if (fs.existsSync(hubDir)) {
    let size = 0;
    try { size = dirSize(hubDir); } catch { /* ignore */ }
    return { state: 'cached', icon: '☁️ ', size };
  }
  return { state: 'not installed', icon: '⬇️ ', size: 0 };
}

module.exports = async function models(ctx, { positionals }) {
  const { config, logger, paths } = ctx;
  const cfg = config.all();
  const sub = positionals.shift() || 'list';

  if (sub === 'path') {
    // eslint-disable-next-line no-console
    console.log(paths.modelsDir);
    return;
  }

  if (sub === 'list') {
    const engine = new EngineManager(ctx);
    let inMemory = [];
    if (await engine.isUp()) {
      try {
        const m = await engine.bridge.listModels();
        inMemory = (m.data || []).map((x) => x.id);
      } catch {
        /* ignore */
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Models  (dir: ${paths.modelsDir})\n`);
    // eslint-disable-next-line no-console
    console.log(`  ${'ROLE'.padEnd(12)}${'STATUS'.padEnd(22)}${'SIZE'.padEnd(9)}MODEL`);
    for (const role of ['voicedesign', 'base', 'custom']) {
      const id = cfg.models[role];
      const st = modelStatus(id, paths.modelsDir);
      const loaded = inMemory.some((x) => x === id || x.endsWith('/' + id.split('/').pop()));
      const label = `${st.icon} ${st.state}${loaded ? ' · loaded' : ''}`;
      const size = st.size ? `${(st.size / 1048576).toFixed(0)}MB` : '-';
      // eslint-disable-next-line no-console
      console.log(`  ${role.padEnd(12)}${label.padEnd(22)}${size.padEnd(9)}${id}`);
    }
    // eslint-disable-next-line no-console
    console.log('\n  ✅ installed (qvox dir)   ☁️ cached (HF)   ⬇️ not installed');
    return;
  }

  if (sub === 'download') {
    const arg = positionals.shift();
    if (!arg) {
      logger.error('usage: qvox models download <role|hf-id>  (role: voicedesign|base|custom)');
      process.exit(1);
    }
    const id = cfg.models[arg] || arg;
    const dest = path.join(paths.modelsDir, id.split('/').pop());
    logger.info(`downloading ${id} -> ${dest}`);
    const script = path.join(paths.pythonDir, 'download.py');
    await new Promise((res, rej) => {
      const p = spawn('uv', ['run', script, id, dest], {
        stdio: 'inherit',
        env: {
          ...process.env,
          HF_HUB_ENABLE_HF_TRANSFER: cfg.hf.enableHfTransfer ? '1' : '0',
          ...(cfg.hf.token ? { HF_TOKEN: cfg.hf.token } : {}),
        },
      });
      p.on('exit', (code) => (code === 0 ? res() : rej(new Error('download exited ' + code))));
    });
    logger.ok('download complete: ' + dest);
    return;
  }

  if (sub === 'remove') {
    const name = positionals.shift();
    const target = path.join(paths.modelsDir, name || '');
    if (!name || !fs.existsSync(target)) {
      logger.error('does not exist: ' + target);
      process.exit(1);
    }
    fs.rmSync(target, { recursive: true, force: true });
    logger.ok('removed: ' + target);
    return;
  }

  logger.error(`unknown subcommand: ${sub} (list|download|remove|path)`);
  process.exit(1);
};
