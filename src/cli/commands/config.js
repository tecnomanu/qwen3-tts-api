'use strict';
/** Ver/editar config: qvox config get [path] | set <path> <val> | path | edit | show */
const { execSync } = require('child_process');

function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

module.exports = async function config(ctx, { positionals }) {
  const { config: store, logger, paths } = ctx;
  const sub = positionals.shift() || 'show';

  switch (sub) {
    case 'path':
      // eslint-disable-next-line no-console
      console.log(paths.configFile);
      break;
    case 'show':
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(store.all(), null, 2));
      break;
    case 'get': {
      const key = positionals.shift();
      // eslint-disable-next-line no-console
      console.log(key ? JSON.stringify(store.get(key)) : JSON.stringify(store.all(), null, 2));
      break;
    }
    case 'set': {
      const key = positionals.shift();
      const val = positionals.shift();
      if (!key || val === undefined) {
        logger.error('uso: qvox config set <path> <valor>');
        process.exit(1);
      }
      store.set(key, coerce(val)).save();
      logger.ok(`${key} = ${coerce(val)}  (guardado)`);
      break;
    }
    case 'edit':
      execSync(`${process.env.EDITOR || 'nano'} ${paths.configFile}`, { stdio: 'inherit' });
      break;
    default:
      logger.error(`subcomando desconocido: ${sub} (get|set|path|edit|show)`);
      process.exit(1);
  }
};
