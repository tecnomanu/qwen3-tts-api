'use strict';
/** Initial wizard: creates config + folders and checks system dependencies. */
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
  logger.info(`Setting up ${brand.displayName} in ${paths.root}`);

  if (!fs.existsSync(paths.configFile)) {
    config.save();
    logger.ok('config.json created');
  } else {
    logger.info('config.json already exists (left untouched)');
  }

  // system dependencies
  const checks = [
    ['uv', 'python manager (recommended) — https://docs.astral.sh/uv/'],
    ['python3', 'fallback if you do not use uv'],
    ['ffmpeg', 'audio conversion (mp3/ogg)'],
  ];
  logger.info('System dependencies:');
  for (const [bin, why] of checks) {
    // eslint-disable-next-line no-console
    console.log(`  ${has(bin) ? '[ok]' : '[--]'} ${bin.padEnd(8)} ${why}`);
  }

  // likely backend
  const isMac = process.platform === 'darwin' && process.arch === 'arm64';
  logger.info(`Suggested backend: ${isMac ? 'mlx (Apple Silicon, fast)' : 'torch (CUDA/ROCm/CPU)'}`);

  logger.ok(`Done. Try:  ${brand.cli} serve`);
};
