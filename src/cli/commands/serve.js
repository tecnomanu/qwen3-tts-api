'use strict';
/** Start the daemon: inference engine (python) + API/panel (node). */
const { EngineManager } = require('../../engine/EngineManager');
const { startServer } = require('../../server/server');

module.exports = async function serve(ctx, { flags }) {
  const { config, logger, brand } = ctx;

  // per-run flag overrides
  if (flags.host) config.set('host', flags.host);
  if (flags.port) config.set('port', Number(flags.port));
  if (flags['api-key']) config.set('apiKey', flags['api-key']);

  const cfg = config.all();
  const engine = new EngineManager(ctx);

  if (cfg.engine.autostart && !flags['no-engine']) {
    await engine.start();
  } else {
    logger.warn('engine autostart disabled (--no-engine or config). The server starts anyway.');
  }

  const server = await startServer(ctx, { engine });
  const url = `http://${cfg.host}:${cfg.port}`;
  logger.ok(`${brand.displayName} listening on ${url}`);
  logger.info(`Panel:  ${url}/`);
  logger.info(`API:    ${url}/v1/audio/speech`);
  if (!cfg.apiKey && cfg.host !== '127.0.0.1') {
    logger.warn('Exposing on the network WITHOUT an api key. Set one with: ' + brand.cli + ' config set apiKey <key>');
  }

  // keep alive + clean shutdown
  const shutdown = async (sig) => {
    logger.info(`\n${sig} received, shutting down...`);
    try {
      server.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};
