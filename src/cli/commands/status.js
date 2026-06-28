'use strict';
/** Daemon + engine status. */
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function status(ctx) {
  const { config, logger, paths, brand } = ctx;
  const cfg = config.all();
  const engine = new EngineManager(ctx);
  const up = await engine.isUp();

  // eslint-disable-next-line no-console
  console.log(`
${brand.displayName} status
  data dir   : ${paths.root}
  config     : ${paths.configFile}
  host:port  : ${cfg.host}:${cfg.port}
  api key    : ${cfg.apiKey ? 'yes (protected)' : 'no (open)'}
  engine     : backend=${cfg.engine.backend} port=${cfg.engine.port}  ->  ${up ? '🟢 UP' : '🔴 DOWN'}
  models dir : ${paths.modelsDir}
`);
  if (up) {
    try {
      const h = await engine.bridge.health();
      logger.info('engine health: ' + JSON.stringify(h));
    } catch {
      /* ignore */
    }
  }
};
