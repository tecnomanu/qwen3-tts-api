'use strict';
/** Update the package via npm and restart the engine. */
const { execSync } = require('child_process');
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function update(ctx, { flags }) {
  const { logger } = ctx;
  const pkg = require('../../../package.json').name;
  const tag = flags.tag || 'latest';
  logger.info(`updating ${pkg}@${tag} (npm -g)...`);
  try {
    execSync(`npm install -g ${pkg}@${tag}`, { stdio: 'inherit' });
    logger.ok('updated');
  } catch (e) {
    logger.error('npm install -g failed: ' + e.message);
    process.exit(1);
  }
  try {
    await new EngineManager(ctx).restart();
  } catch {
    logger.warn('could not restart the engine (maybe it was not running)');
  }
};
