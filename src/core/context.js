'use strict';
/**
 * Composition root: builds brand + paths + config + logger into a single `ctx`
 * injected into commands and the server (dependency inversion).
 */
const { brand, env } = require('../brand');
const { buildPaths, ensureDirs } = require('./paths');
const { ConfigStore } = require('./config');
const { createLogger } = require('./logger');

function createContext({ ensure = true, logLevel } = {}) {
  const paths = buildPaths();
  if (ensure) ensureDirs(paths);
  const config = new ConfigStore(paths.configFile);
  config.load();
  const level = logLevel || process.env[env('LOG')] || 'info';
  const logger = createLogger(level);
  return { brand, env, paths, config, logger };
}

module.exports = { createContext };
