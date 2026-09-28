'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const voices = require('../src/core/voices');

function tmpPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qvox-voices-'));
  const voicesDir = path.join(root, 'voices');
  fs.mkdirSync(voicesDir);
  return { root, voicesDir };
}

const hasFfmpeg = !spawnSync('ffmpeg', ['-version']).error;

test('a saved voice resolves by name; anything else passes through untouched', () => {
  const paths = tmpPaths();
  fs.writeFileSync(path.join(paths.voicesDir, 'ana.wav'), 'x');

  assert.strictEqual(voices.resolve(paths, 'ana'), path.join(paths.voicesDir, 'ana.wav'));
  assert.strictEqual(voices.resolve(paths, '/abs/ref.wav'), '/abs/ref.wav');
  assert.strictEqual(voices.resolve(paths, 'nobody'), 'nobody');
});

test('names that could leave the voices folder are never looked up', () => {
  const paths = tmpPaths();
  for (const bad of ['../ana', 'Manu', 'a/b', '.hidden', '', 'x'.repeat(41)]) {
    assert.strictEqual(voices.isName(bad), false, bad);
    assert.strictEqual(voices.resolve(paths, bad), bad);
  }
  assert.strictEqual(voices.remove(paths, '../config'), false);
});

test('list reads metadata and still shows a wav dropped in by hand', () => {
  const paths = tmpPaths();
  fs.writeFileSync(path.join(paths.voicesDir, 'hand.wav'), 'x');
  fs.writeFileSync(path.join(paths.voicesDir, 'made.wav'), 'x');
  fs.writeFileSync(path.join(paths.voicesDir, 'made.json'), JSON.stringify({
    duration: 31.2, created: '2099-01-01T00:00:00Z', source: 'note.ogg', report: { verdict: 'good' },
  }));

  const items = voices.list(paths);
  assert.deepStrictEqual(items.map((v) => v.name), ['made', 'hand']);
  assert.strictEqual(items[0].verdict, 'good');
  assert.strictEqual(items[1].duration, null);

  assert.strictEqual(voices.remove(paths, 'made'), true);
  assert.deepStrictEqual(voices.list(paths).map((v) => v.name), ['hand']);
});

test('the verdict says what to fix, in the order it matters', () => {
  const clean = { noise: -65, speech: -15, peak: -3 };
  assert.strictEqual(voices.judge({ length: 32, before: clean, after: clean, sourceDuration: 32 }).verdict, 'good');

  const short = voices.judge({ length: 5, before: clean, after: clean, sourceDuration: 5 });
  assert.strictEqual(short.verdict, 'poor');
  assert.match(short.warnings[0], /too short/);

  const noisy = voices.judge({ length: 32, before: clean, after: { noise: -35, speech: -15, peak: -3 }, sourceDuration: 32 });
  assert.strictEqual(noisy.verdict, 'poor');
  assert.match(noisy.warnings.join(' '), /background noise/);

  const clipped = voices.judge({ length: 32, before: { ...clean, peak: 0 }, after: clean, sourceDuration: 32 });
  assert.strictEqual(clipped.verdict, 'usable');
  assert.match(clipped.warnings[0], /clips/);
});

test('prepare cuts, cleans and saves a 24 kHz mono reference with its record', { skip: !hasFfmpeg && 'ffmpeg not installed' }, () => {
  const paths = tmpPaths();
  const input = path.join(paths.root, 'in.wav');
  // 60 s of a tone over faint noise: long enough to be cut to 40 s.
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=60',
    '-f', 'lavfi', '-i', 'anoisesrc=amplitude=0.002:duration=60', '-filter_complex', 'amix=inputs=2', '-ar', '44100', input]);

  const v = voices.prepare(paths, { input, name: 'tone', start: 5 });
  assert.strictEqual(v.file, path.join(paths.voicesDir, 'tone.wav'));
  assert.ok(Math.abs(v.duration - voices.IDEAL.max) < 0.5, `duration ${v.duration}`);
  assert.ok(v.report.warnings.some((w) => /trimmed/.test(w)));

  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=p=0', v.file], { encoding: 'utf8' });
  assert.strictEqual(probe.stdout.trim(), '24000,1');

  const meta = JSON.parse(fs.readFileSync(path.join(paths.voicesDir, 'tone.json'), 'utf8'));
  assert.strictEqual(meta.source, 'in.wav');
  assert.strictEqual(meta.start, 5);

  assert.throws(() => voices.prepare(paths, { input, name: '../x' }), /invalid name/);
  assert.throws(() => voices.prepare(paths, { input, name: 'late', start: 999 }), /past the end/);
});
