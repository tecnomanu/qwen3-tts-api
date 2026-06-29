'use strict';
/** Update the package and restart the engine.
 * If published on npm -> npm install -g. Otherwise fall back to a git checkout. */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EngineManager } = require('../../engine/EngineManager');

function isOnNpm(pkg) {
  try {
    execSync(`npm view ${pkg} version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

module.exports = async function update(ctx, { flags }) {
  const { logger } = ctx;
  const pkg = require('../../../package.json').name;
  const repoRoot = path.join(__dirname, '..', '..', '..'); // package root (its own checkout if cloned)
  const fromGit = fs.existsSync(path.join(repoRoot, '.git'));

  let updated = false;
  if (isOnNpm(pkg) && !flags.git) {
    const tag = flags.tag || 'latest';
    logger.info(`updating ${pkg}@${tag} (npm -g)...`);
    try {
      execSync(`npm install -g ${pkg}@${tag}`, { stdio: 'inherit' });
      logger.ok('updated from npm');
      updated = true;
    } catch (e) {
      logger.error('npm install -g failed: ' + e.message);
    }
  } else if (fromGit) {
    logger.info(`not on npm yet — updating from git checkout at ${repoRoot}`);
    try {
      execSync('git pull --ff-only', { cwd: repoRoot, stdio: 'inherit' });
      execSync('npm install -g .', { cwd: repoRoot, stdio: 'inherit' });
      logger.ok('updated from git');
      updated = true;
    } catch (e) {
      logger.error('git update failed: ' + e.message);
    }
  } else {
    logger.warn(`${pkg} is not on npm yet, and this install is not a git checkout.`);
    logger.warn('Update by reinstalling from the repo:');
    logger.warn('  git clone https://github.com/tecnomanu/qwen3-tts-api && cd qwen3-tts-api && npm install -g .');
  }

  if (!updated) process.exit(1);
  try {
    await new EngineManager(ctx).restart();
  } catch {
    logger.warn('could not restart the engine (maybe it was not running)');
  }
};
