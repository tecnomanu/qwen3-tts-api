'use strict';
/**
 * ConfigStore: loads/saves config from a JSON file (no DB).
 * Precedence (highest wins): env vars > config.json > defaults.
 * Single responsibility: persistent configuration state.
 */
const fs = require('fs');
const defaults = require('./defaults');
const { env } = require('../brand');

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return over === undefined ? base : over;
  }
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

/** Overrides from brand-prefixed environment variables. */
function envOverrides() {
  const o = {};
  if (process.env[env('HOST')]) o.host = process.env[env('HOST')];
  if (process.env[env('PORT')]) o.port = Number(process.env[env('PORT')]);
  if (process.env[env('API_KEY')]) o.apiKey = process.env[env('API_KEY')];
  if (process.env.HF_TOKEN) o.hf = { token: process.env.HF_TOKEN };
  return o;
}

class ConfigStore {
  constructor(configFile) {
    this.file = configFile;
    this.data = { ...defaults };
  }

  load() {
    let fileData = {};
    if (fs.existsSync(this.file)) {
      try {
        fileData = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch (e) {
        throw new Error(`invalid config.json (${this.file}): ${e.message}`);
      }
    }
    this.data = deepMerge(deepMerge(defaults, fileData), envOverrides());
    return this.data;
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    return this.file;
  }

  /** get('engine.port') -> nested value by dot-path */
  get(dotPath) {
    return dotPath.split('.').reduce((o, k) => (o == null ? o : o[k]), this.data);
  }

  /** set('engine.port', 5200) -> sets nested value (not persisted until save()) */
  set(dotPath, value) {
    const keys = dotPath.split('.');
    const last = keys.pop();
    let node = this.data;
    for (const k of keys) {
      if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
      node = node[k];
    }
    node[last] = value;
    return this;
  }

  all() {
    return this.data;
  }
}

module.exports = { ConfigStore, deepMerge };
