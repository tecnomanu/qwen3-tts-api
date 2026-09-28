'use strict';
/** Initial wizard: creates config + folders and checks system dependencies. */
const fs = require('fs');

module.exports = async function setup(ctx) {
  const { logger, paths, config, brand } = ctx;
  logger.info(`Setting up ${brand.displayName} in ${paths.root}`);

  if (!fs.existsSync(paths.configFile)) {
    config.save();
    logger.ok('config.json created');
  } else {
    logger.info('config.json already exists (left untouched)');
  }

  // Requirements first: whether this machine is worth the model download.
  const { checkRequirements } = require('../../core/requirements');
  const req = checkRequirements(paths);
  logger.info('Requirements:');
  for (const c of req.checks) {
    const mark = c.level === 'ok' ? '[ok]' : c.level === 'warn' ? '[!!]' : '[--]';
    // eslint-disable-next-line no-console
    console.log(`  ${mark} ${c.name.padEnd(12)} ${c.detail}`);
  }
  if (req.verdict === 'unsupported') {
    logger.error('This machine does not meet the requirements above ([--]). Fix those before downloading models.');
    process.exitCode = 1;
    return;
  }
  if (req.verdict === 'slow') {
    logger.warn('It will run, but slowly. Fine for trying it out; not for long narrations.');
  }

  logger.info(`Suggested backend: ${req.accelerator === 'apple-silicon' ? 'mlx (Apple Silicon, fast)' : 'torch (CUDA/ROCm/CPU)'}`);
  logger.ok(`Done. Try:  ${brand.cli} serve`);
};
