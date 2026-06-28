'use strict';
/** Asistente inicial: crea config + carpetas y verifica dependencias del sistema. */
const fs = require('fs');
const { execSync } = require('child_process');

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

module.exports = async function setup(ctx) {
  const { logger, paths, config, brand } = ctx;
  logger.info(`Configurando ${brand.displayName} en ${paths.root}`);

  if (!fs.existsSync(paths.configFile)) {
    config.save();
    logger.ok('config.json creado');
  } else {
    logger.info('config.json ya existe (no se toca)');
  }

  // dependencias del sistema
  const checks = [
    ['uv', 'gestor python (recomendado) — https://docs.astral.sh/uv/'],
    ['python3', 'fallback si no usás uv'],
    ['ffmpeg', 'conversión de audio (mp3/ogg)'],
  ];
  logger.info('Dependencias del sistema:');
  for (const [bin, why] of checks) {
    // eslint-disable-next-line no-console
    console.log(`  ${has(bin) ? '✅' : '❌'} ${bin.padEnd(8)} ${why}`);
  }

  // backend probable
  const isMac = process.platform === 'darwin' && process.arch === 'arm64';
  logger.info(
    `Backend sugerido: ${isMac ? 'mlx (Apple Silicon, rápido)' : 'torch (CUDA/ROCm/CPU)'}`
  );

  logger.ok(`Listo. Probá:  ${brand.cli} serve`);
};
