'use strict';
/**
 * Router del CLI. Cero dependencias.
 * Uso: qvox <comando> [args] [--flags]
 */
const { brand } = require('../brand');
const { createContext } = require('../core/context');

const COMMANDS = {
  serve: 'Levanta el daemon (API + panel web) y el motor de inferencia',
  speak: 'Genera audio desde texto: qvox speak "Hola" --voice aiden --out demo.wav',
  setup: 'Asistente inicial: crea config y carpetas, verifica dependencias',
  status: 'Muestra estado del daemon y del motor',
  stop: 'Detiene el motor de inferencia',
  restart: 'Reinicia el motor de inferencia',
  config: 'Ver/editar configuración: qvox config get|set|path|edit',
  models: 'Gestiona modelos: qvox models list|download|remove|path',
  update: 'Actualiza qvox (npm) y reinicia el daemon',
  version: 'Muestra la versión',
  help: 'Muestra esta ayuda',
};

/** Parser mínimo de argumentos: separa positionals y flags (--k v / --bool / -o v). */
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else if (a.startsWith('-') && a.length === 2) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function printHelp() {
  const c = brand.cli;
  // eslint-disable-next-line no-console
  console.log(`
${brand.displayName} — ${brand.tagline}

Uso:  ${c} <comando> [opciones]

Comandos:
${Object.entries(COMMANDS)
  .map(([k, d]) => `  ${k.padEnd(9)} ${d}`)
  .join('\n')}

Ejemplos:
  ${c} setup
  ${c} serve --host 0.0.0.0 --port 5111
  ${c} speak "Buenas, ¿cómo andás?" --voice aiden --out demo.wav
  ${c} models list
  ${c} config set apiKey mi-clave-secreta

Datos/config en: ${brand.dataDir}
`);
}

async function run(argv) {
  const { positionals, flags } = parseArgs(argv);
  const cmd = positionals.shift() || 'help';

  if (cmd === 'help' || flags.help || flags.h) return printHelp();
  if (cmd === 'version' || flags.version || flags.v) {
    // eslint-disable-next-line no-console
    console.log(require('../../package.json').version);
    return;
  }
  if (!COMMANDS[cmd]) {
    // eslint-disable-next-line no-console
    console.error(`Comando desconocido: "${cmd}". Probá "${brand.cli} help".`);
    process.exit(1);
  }

  const handler = require(`./commands/${cmd}`);
  const ctx = createContext({ logLevel: flags.debug ? 'debug' : undefined });
  await handler(ctx, { positionals, flags });
}

module.exports = { run, parseArgs };
