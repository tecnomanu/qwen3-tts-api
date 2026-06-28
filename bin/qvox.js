#!/usr/bin/env node
'use strict';
/**
 * Punto de entrada del CLI. Mantener mínimo: delega todo en src/cli/main.js
 * así el binario es estable aunque cambie la implementación.
 */
require('../src/cli/main').run(process.argv.slice(2)).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
