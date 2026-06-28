'use strict';
/**
 * Composition root: arma brand + paths + config + logger en un solo `ctx`
 * que se inyecta a comandos y servidor (inversión de dependencias).
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
