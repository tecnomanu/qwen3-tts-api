'use strict';
/** Manage models: list | download <role|id> | remove <name> | path */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EngineManager } = require('../../engine/EngineManager');
const { listModels } = require('../../core/modelStatus');

const ICON = { installed: '✅', cached: '☁️ ', not_installed: '⬇️ ' };
const LABEL = { installed: 'installed', cached: 'cached', not_installed: 'not installed' };

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
    const rows = listModels(cfg, paths.modelsDir, inMemory);
    // eslint-disable-next-line no-console
    console.log(`Models  (dir: ${paths.modelsDir})\n`);
    // eslint-disable-next-line no-console
    console.log(`  ${'ROLE'.padEnd(12)}${'STATUS'.padEnd(22)}${'SIZE'.padEnd(9)}MODEL`);
    for (const r of rows) {
      const label = `${ICON[r.state]} ${LABEL[r.state]}${r.loaded ? ' · loaded' : ''}`;
      const size = r.sizeMB ? `${r.sizeMB}MB` : '-';
      // eslint-disable-next-line no-console
      console.log(`  ${r.role.padEnd(12)}${label.padEnd(22)}${size.padEnd(9)}${r.id}`);
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
