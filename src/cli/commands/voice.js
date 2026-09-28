'use strict';
/**
 * Cloned voices from the command line.
 *
 *   qvox voice add <name> <file|url> [--start s] [--length s] [--clean auto|strong|light|off]
 *                                    [--text "what the kept part says"] [--consent]
 *   qvox voice test <name> ["text"] [--lang Spanish] [--out file.wav]
 *   qvox voice list
 *   qvox voice remove <name>
 *   qvox voice path
 *
 * `add` is the whole mechanic: any recording (a phone voice note, a video, a
 * clean studio take) becomes a reference the model clones well - measured,
 * cleaned only as much as it needs, cut to 25-40 s and normalised. See
 * docs/VOICE-CLONING.md for how to get a good recording in the first place.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const voices = require('../../core/voices');
const { EngineManager } = require('../../engine/EngineManager');

const SAMPLE = {
  Spanish: 'Hola, esta es mi voz clonada. Si suena natural, con pausas y entonación, la referencia quedó bien.',
  English: 'Hi, this is my cloned voice. If it sounds natural, with pauses and intonation, the reference is good.',
};

const CONSENT_TEXT = [
  'Voice cloning copies a real person\'s voice.',
  'Only clone your own voice, or a voice whose owner gave you permission',
  '(for a synthetic voice, check its licence allows reuse). Never use a clone',
  'to impersonate someone or to deceive.',
].join('\n  ');

function out(line = '') {
  // eslint-disable-next-line no-console
  console.log(line);
}

async function confirmConsent(flags) {
  if (flags.consent) return true;
  if (!process.stdin.isTTY) return false;
  out(`\n  ${CONSENT_TEXT}\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('  Do you have the right to use this voice? [y/N] ', r));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

/** A URL is downloaded with yt-dlp (audio only) into a temp file. */
function fetchUrl(url, logger) {
  const probe = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
  if (probe.error) throw new Error('downloading from a URL needs yt-dlp - https://github.com/yt-dlp/yt-dlp');
  const base = path.join(os.tmpdir(), `qvox-dl-${process.pid}`);
  logger.info(`downloading audio from ${url} ...`);
  const r = spawnSync('yt-dlp', ['-q', '--no-playlist', '-x', '--audio-format', 'wav', '-o', `${base}.%(ext)s`, url],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0 || !fs.existsSync(`${base}.wav`)) throw new Error('yt-dlp could not download that URL');
  return `${base}.wav`;
}

function printReport(v) {
  const r = v.report;
  out('');
  out(`  voice      ${v.name}  ->  ${v.file}`);
  out(`  length     ${v.duration} s  (from ${v.start} s of ${v.source})`);
  out(`  clean-up   ${r.chain}`);
  const snr = (x) => (x.speech - x.noise).toFixed(0);
  out(`  voice/noise ${snr(r.before)} dB  ->  ${snr(r.after)} dB   (higher is better, aim for 40+)`);
  out(`  levels     speech ${r.after.speech} dB, room ${r.after.noise} dB`);
  out(`  peak       ${r.before.peak} dB (original)`);
  out(`  verdict    ${r.verdict.toUpperCase()}`);
  for (const w of r.warnings) out(`   [--] ${w}`);
  out('');
}

async function add(ctx, positionals, flags) {
  const { logger, paths } = ctx;
  const [name, source] = positionals;
  if (!name || !source) {
    logger.error('usage: qvox voice add <name> <file|url> [--start s] [--length s] [--clean auto|strong|light|off]');
    process.exit(1);
  }
  if (!voices.isName(name)) {
    logger.error(`invalid name "${name}": lowercase letters, digits, - or _`);
    process.exit(1);
  }
  if (!(await confirmConsent(flags))) {
    logger.error(`consent required. ${CONSENT_TEXT.replace(/\n\s*/g, ' ')} Re-run with --consent to confirm.`);
    process.exit(1);
  }

  const isUrl = /^https?:\/\//i.test(source);
  const input = isUrl ? fetchUrl(source, logger) : path.resolve(source);
  try {
    const v = voices.prepare(paths, {
      input,
      name,
      start: flags.start ? Number(flags.start) : 0,
      length: flags.length ? Number(flags.length) : null,
      clean: flags.clean || 'auto',
      source: isUrl ? source : path.basename(input),
      refText: typeof flags.text === 'string' ? flags.text : null,
    });
    printReport(v);
    if (v.report.verdict === 'poor') {
      logger.warn('this reference will clone badly - fix the warnings above and add it again');
    } else {
      logger.ok(`ready. Try it:  qvox voice test ${name}`);
    }
  } finally {
    if (isUrl && fs.existsSync(input)) fs.unlinkSync(input);
  }
}

async function test(ctx, positionals, flags) {
  const { logger, paths, config } = ctx;
  const [name, ...words] = positionals;
  const file = name ? voices.resolve(paths, name) : null;
  if (!file || file === name) {
    logger.error(`no saved voice "${name ?? ''}". See: qvox voice list`);
    process.exit(1);
  }
  const language = flags.lang || config.get('tts.language') || 'Spanish';
  const text = words.join(' ').trim() || SAMPLE[language] || SAMPLE.English;

  const engine = new EngineManager(ctx);
  if (!(await engine.isUp())) {
    logger.info('engine was not running, starting it...');
    await engine.start();
  }
  logger.info(`speaking with "${name}" ...`);
  const t0 = Date.now();
  const { buffer } = await engine.bridge.speak({
    input: text, language, clone: file, temperature: Number(flags.temp || config.get('tts.temperature') || 0.7),
  });
  const raw = path.join(os.tmpdir(), `qvox-test-${process.pid}.wav`);
  fs.writeFileSync(raw, buffer);

  // Clone output comes back ~25 dB quieter than it should; bring it to the
  // usual -16 LUFS so the test is heard at the level it will be used at.
  const outFile = path.resolve(flags.out || flags.o || path.join(paths.outDir, `voice-${name}.wav`));
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1', outFile], { encoding: 'utf8' });
  if (r.status !== 0) fs.copyFileSync(raw, outFile);
  fs.unlinkSync(raw);
  logger.ok(`saved ${outFile}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

function list(ctx) {
  const items = voices.list(ctx.paths);
  if (!items.length) {
    out(`no voices yet. Add one:  qvox voice add <name> <recording>`);
    return;
  }
  out(`${'NAME'.padEnd(20)} ${'LENGTH'.padEnd(8)} ${'VERDICT'.padEnd(8)} SOURCE`);
  for (const v of items) {
    const len = v.duration != null ? `${v.duration}s` : '?';
    out(`${v.name.padEnd(20)} ${len.padEnd(8)} ${(v.verdict || '-').padEnd(8)} ${v.source || '-'}`);
  }
}

module.exports = async function voice(ctx, { positionals, flags }) {
  const sub = positionals.shift();
  switch (sub) {
    case 'add':
      return add(ctx, positionals, flags);
    case 'test':
      return test(ctx, positionals, flags);
    case 'list':
    case undefined:
      return list(ctx);
    case 'remove':
    case 'rm': {
      const ok = voices.remove(ctx.paths, positionals[0]);
      if (ok) ctx.logger.ok(`removed ${positionals[0]}`);
      else ctx.logger.error(`no saved voice "${positionals[0] ?? ''}"`);
      return;
    }
    case 'path':
      return out(ctx.paths.voicesDir);
    default:
      ctx.logger.error(`unknown subcommand "${sub}". Use: add | test | list | remove | path`);
      process.exit(1);
  }
};
