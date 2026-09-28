'use strict';
/** Generate audio from text. Starts the engine if needed. */
const fs = require('fs');
const path = require('path');
const { EngineManager } = require('../../engine/EngineManager');
const voices = require('../../core/voices');

module.exports = async function speak(ctx, { positionals, flags }) {
  const { config, logger, paths } = ctx;
  const text = positionals.join(' ').trim();
  if (!text) {
    logger.error('Missing text. e.g.: qvox speak "Hi there" --voice aiden --out demo.wav');
    process.exit(1);
  }
  const cfg = config.all();
  const engine = new EngineManager(ctx);
  if (!(await engine.isUp())) {
    logger.info('engine was not running, starting it...');
    await engine.start();
  }

  const body = {
    input: text,
    language: flags.lang || cfg.tts.language,
    temperature: flags.temp ? Number(flags.temp) : cfg.tts.temperature,
  };
  if (flags.instruct) body.instruct = flags.instruct;
  if (flags.clone) {
    // a saved voice's name (qvox voice add) or a path to a reference wav
    const saved = voices.resolve(paths, flags.clone);
    body.clone = saved !== flags.clone ? saved : path.resolve(flags.clone);
  }
  if (flags.voice) body.voice = flags.voice;

  const out = path.resolve(flags.out || flags.o || path.join(paths.outDir, 'speak.wav'));
  logger.info(`generating (${text.length} chars)...`);
  const t0 = Date.now();
  const { buffer } = await engine.bridge.speak(body);
  fs.writeFileSync(out, buffer);
  logger.ok(`audio saved: ${out}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
};
