'use strict';
/** Genera audio desde texto. Levanta el engine si hace falta. */
const fs = require('fs');
const path = require('path');
const { EngineManager } = require('../../engine/EngineManager');

module.exports = async function speak(ctx, { positionals, flags }) {
  const { config, logger, paths } = ctx;
  const text = positionals.join(' ').trim();
  if (!text) {
    logger.error('Falta el texto. Ej: qvox speak "Hola che" --voice aiden --out demo.wav');
    process.exit(1);
  }
  const cfg = config.all();
  const engine = new EngineManager(ctx);
  if (!(await engine.isUp())) {
    logger.info('engine no estaba corriendo, lo levanto...');
    await engine.start();
  }

  const body = {
    input: text,
    language: flags.lang || cfg.tts.language,
    temperature: flags.temp ? Number(flags.temp) : cfg.tts.temperature,
  };
  if (flags.instruct) body.instruct = flags.instruct;
  if (flags.clone) body.clone = path.resolve(flags.clone); // ruta a wav de referencia
  if (flags.voice) body.voice = flags.voice;

  const out = path.resolve(flags.out || flags.o || path.join(paths.outDir, 'speak.wav'));
  logger.info(`generando (${text.length} chars)...`);
  const t0 = Date.now();
  const { buffer } = await engine.bridge.speak(body);
  fs.writeFileSync(out, buffer);
  logger.ok(`audio guardado: ${out}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
};
