'use strict';
/** Logger mínimo con niveles y colores. Sin dependencias. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const C = {
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

function createLogger(level = 'info') {
  const min = LEVELS[level] || LEVELS.info;
  const out = (lvl, color, args) => {
    if (LEVELS[lvl] < min) return;
    const ts = C.gray(new Date().toISOString().slice(11, 19));
    const tag = color(`[${lvl}]`);
    // eslint-disable-next-line no-console
    (lvl === 'error' ? console.error : console.log)(ts, tag, ...args);
  };
  return {
    level,
    debug: (...a) => out('debug', C.gray, a),
    info: (...a) => out('info', C.cyan, a),
    warn: (...a) => out('warn', C.yellow, a),
    error: (...a) => out('error', C.red, a),
    ok: (...a) => out('info', C.green, a),
  };
}

module.exports = { createLogger };
