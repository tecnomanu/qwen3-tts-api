'use strict';
/** Gestiona modelos: list | download <role|id> | remove <name> | path */
const fs = require('fs');
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
    // eslint-disable-next-line no-console
    console.log('Roles configurados:');
    for (const role of ['voicedesign', 'base', 'custom']) {
      // eslint-disable-next-line no-console
      console.log(`  ${role.padEnd(12)} ${cfg.models[role]}`);
    }
    // eslint-disable-next-line no-console
    console.log(`\nDescargados en ${paths.modelsDir}:`);
    const entries = fs.existsSync(paths.modelsDir)
      ? fs.readdirSync(paths.modelsDir, { withFileTypes: true }).filter((e) => e.isDirectory())
      : [];
    if (!entries.length) console.log('  (ninguno)');
    for (const e of entries) {
      const mb = (dirSize(path.join(paths.modelsDir, e.name)) / 1048576).toFixed(0);
      // eslint-disable-next-line no-console
      console.log(`  ${e.name.padEnd(28)} ${mb} MB`);
    }
    const engine = new EngineManager(ctx);
    if (await engine.isUp()) {
      try {
        const m = await engine.bridge.listModels();
        logger.info('cargados en memoria: ' + JSON.stringify(m.data ? m.data.map((x) => x.id) : m));
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (sub === 'download') {
    const arg = positionals.shift();
    if (!arg) {
      logger.error('uso: qvox models download <role|hf-id>  (role: voicedesign|base|custom)');
      process.exit(1);
    }
    const id = cfg.models[arg] || arg;
    const dest = path.join(paths.modelsDir, id.split('/').pop());
    logger.info(`descargando ${id} -> ${dest}`);
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
      p.on('exit', (code) => (code === 0 ? res() : rej(new Error('download exit ' + code))));
    });
    logger.ok('descarga completa: ' + dest);
    return;
  }

  if (sub === 'remove') {
    const name = positionals.shift();
    const target = path.join(paths.modelsDir, name || '');
    if (!name || !fs.existsSync(target)) {
      logger.error('no existe: ' + target);
      process.exit(1);
    }
    fs.rmSync(target, { recursive: true, force: true });
    logger.ok('eliminado: ' + target);
    return;
  }

  logger.error(`subcomando desconocido: ${sub} (list|download|remove|path)`);
  process.exit(1);
};
