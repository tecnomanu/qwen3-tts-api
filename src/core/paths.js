'use strict';
/**
 * Resolves ALL paths from brand.dataDir.
 * Allows overriding the root folder via env ($QVOX_HOME) or config.
 * Single responsibility: where each thing lives.
 */
const path = require('path');
const fs = require('fs');
const { brand } = require('../brand');

function resolveRoot(override) {
  return override || brand.dataDir;
}

function buildPaths(rootOverride) {
  const root = resolveRoot(rootOverride);
  return {
    root, // ~/.qvox
    configFile: path.join(root, 'config.json'),
    modelsDir: path.join(root, 'models'), // downloaded weights
    voicesDir: path.join(root, 'voices'), // cloned voice refs (24k wav)
    outDir: path.join(root, 'out'), // audio generated from the CLI
    logsDir: path.join(root, 'logs'),
    runDir: path.join(root, 'run'), // pid/sockets
    pidFile: path.join(root, 'run', 'engine.pid'),
    pythonDir: path.join(__dirname, '..', 'python'), // worker code (in the package)
  };
}

/** Create the data folders if they do not exist (idempotent). */
function ensureDirs(p) {
  for (const dir of [p.root, p.modelsDir, p.voicesDir, p.outDir, p.logsDir, p.runDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

module.exports = { buildPaths, ensureDirs, resolveRoot };
