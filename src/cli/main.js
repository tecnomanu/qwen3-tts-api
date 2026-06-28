'use strict';
/**
 * CLI router. Zero dependencies.
 * Usage: qvox <command> [args] [--flags]
 */
const { brand } = require('../brand');
const { createContext } = require('../core/context');

const COMMANDS = {
  serve: 'Start the daemon (API + web panel) and the inference engine',
  speak: 'Generate audio from text: qvox speak "Hello" --voice aiden --out demo.wav',
  setup: 'Initial wizard: creates config and folders, checks dependencies',
  status: 'Show daemon and engine status',
  stop: 'Stop the inference engine',
  restart: 'Restart the inference engine',
  config: 'View/edit configuration: qvox config get|set|path|edit',
  models: 'Manage models: qvox models list|download|remove|path',
  update: 'Update qvox (npm) and restart the daemon',
  version: 'Show the version',
  help: 'Show this help',
};

/** Minimal argument parser: splits positionals and flags (--k v / --bool / -o v). */
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

Usage:  ${c} <command> [options]

Commands:
${Object.entries(COMMANDS)
  .map(([k, d]) => `  ${k.padEnd(9)} ${d}`)
  .join('\n')}

Examples:
  ${c} setup
  ${c} serve --host 0.0.0.0 --port 5111
  ${c} speak "Hi there" --voice aiden --out demo.wav
  ${c} models list
  ${c} config set apiKey my-secret-key

Data/config in: ${brand.dataDir}
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
    console.error(`Unknown command: "${cmd}". Try "${brand.cli} help".`);
    process.exit(1);
  }

  const handler = require(`./commands/${cmd}`);
  const ctx = createContext({ logLevel: flags.debug ? 'debug' : undefined });
  await handler(ctx, { positionals, flags });
}

module.exports = { run, parseArgs };
