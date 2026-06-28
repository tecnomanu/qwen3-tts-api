'use strict';
/** Actualiza el paquete por npm y reinicia el engine. */
const { execSync } = require('child_process');
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function update(ctx, { flags }) {
  const { logger } = ctx;
  const pkg = require('../../../package.json').name;
  const tag = flags.tag || 'latest';
  logger.info(`actualizando ${pkg}@${tag} (npm -g)...`);
  try {
    execSync(`npm install -g ${pkg}@${tag}`, { stdio: 'inherit' });
    logger.ok('actualizado');
  } catch (e) {
    logger.error('falló npm install -g: ' + e.message);
    process.exit(1);
  }
  try {
    await new EngineManager(ctx).restart();
  } catch {
    logger.warn('no se pudo reiniciar el engine (quizá no estaba corriendo)');
  }
};
