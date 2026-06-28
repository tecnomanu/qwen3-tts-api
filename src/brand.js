'use strict';
/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  SINGLE SOURCE OF THE NAME.                                            │
 * │  Change CODENAME and it propagates to: CLI command, data folder,      │
 * │  environment-variable prefix, panel titles, etc.                      │
 * │                                                                       │
 * │  (Exception: the binary name in package.json -> "bin" is static, a    │
 * │   requirement of npm. If you rename, also update package.json "bin".) │
 * └──────────────────────────────────────────────────────────────────────┘
 */
const os = require('os');
const path = require('path');

const CODENAME = 'qvox'; // <-- change it here

const ENV = CODENAME.toUpperCase();

const brand = {
  /** short, lowercase code */
  code: CODENAME,
  /** terminal command */
  cli: CODENAME,
  /** display name (customizable) */
  displayName: 'QVox',
  /** short description for help/panel */
  tagline: 'Local TTS server (Qwen3-TTS) with cloneable voices',
  /** environment variable prefix: QVOX_HOST, QVOX_PORT, QVOX_API_KEY... */
  envPrefix: ENV,
  /** root folder for data/config/models (override with $QVOX_HOME) */
  dataDir: process.env[`${ENV}_HOME`] || path.join(os.homedir(), `.${CODENAME}`),
  /** repo name (for SEO/clone) — intentionally separate from codename */
  repo: 'qwen3-tts-api',
};

/** Helper: brand-prefixed env var name. env('PORT') -> 'QVOX_PORT' */
function env(name) {
  return `${brand.envPrefix}_${name}`;
}

module.exports = { brand, CODENAME, env };
