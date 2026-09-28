'use strict';
/**
 * Cloned voices: turning any recording into a good reference, and finding it
 * again by name.
 *
 * A clone reproduces whatever is in the reference - its room noise, its
 * clipping, its flat delivery - so the quality of every future line is decided
 * here, once. `prepare()` measures the recording, cleans only as much as it
 * needs, cuts it to the length the model likes (25-40 s), normalises it and
 * saves a 24 kHz mono wav next to a small JSON of what was done. `resolve()`
 * lets the API and the CLI take a voice by name instead of an absolute path.
 *
 * Needs ffmpeg/ffprobe on PATH. Node stays dependency-free: everything here is
 * child_process + fs.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/** Voice names: lowercase, digits, dash, underscore - safe as a file name. */
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** Reference length the model clones best from (seconds). */
const IDEAL = { min: 25, max: 40, floor: 8 };

/**
 * Signal-to-noise (speech level minus room level, dB) below which the strong
 * clean-up chain is used. It has to be relative: a quiet phone note can have a
 * low absolute floor and still be mostly hiss once it is brought up to speech
 * level - which normalising then does, noise included.
 */
const NOISY_SNR = 40;
/** After clean-up: below GOOD_SNR it is worth a warning, below POOR_SNR it will clone badly. */
const GOOD_SNR = 38;
const POOR_SNR = 26;

/**
 * The strong chain: measured on a phone voice note (.ogg, ~-54 dB floor) it
 * took the floor to ~-64 dB while keeping speech near -17 dB. The light chain
 * is for recordings that are already clean - denoising clean audio only
 * smears the voice.
 */
const CHAINS = {
  off: [],
  light: ['highpass=f=80'],
  strong: [
    'highpass=f=95',
    'anlmdn=s=0.0012:p=0.006:r=0.008',
    'afftdn=nr=32:nf=-45:tn=1',
    'equalizer=f=250:t=q:w=1.2:g=-2',
    'agate=threshold=0.014:ratio=8:attack=6:release=160',
  ],
};
const LOUDNESS = 'loudnorm=I=-18:TP=-2:LRA=9';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} not found - install it (https://ffmpeg.org/download.html)`);
  return r;
}

function isName(value) {
  return typeof value === 'string' && NAME_RE.test(value);
}

function fileFor(paths, name) {
  return path.join(paths.voicesDir, `${name}.wav`);
}

/**
 * A `clone` value as the engine needs it: a saved voice's name becomes its wav
 * path; anything else is left as given (an explicit path). Only names that
 * match NAME_RE are looked up, so a value can never walk out of voicesDir.
 */
function resolve(paths, value) {
  if (isName(value) && fs.existsSync(fileFor(paths, value))) return fileFor(paths, value);
  return value;
}

/** Saved voices, newest first, with whatever was recorded about them. */
function list(paths) {
  if (!fs.existsSync(paths.voicesDir)) return [];
  return fs
    .readdirSync(paths.voicesDir)
    .filter((f) => f.endsWith('.wav') && isName(f.slice(0, -4)))
    .map((f) => {
      const name = f.slice(0, -4);
      const metaFile = path.join(paths.voicesDir, `${name}.json`);
      let meta = {};
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      } catch {
        /* a wav dropped in by hand has no metadata - still a voice */
      }
      const stat = fs.statSync(path.join(paths.voicesDir, f));
      return {
        name,
        file: path.join(paths.voicesDir, f),
        duration: meta.duration ?? null,
        created: meta.created ?? stat.mtime.toISOString(),
        source: meta.source ?? null,
        verdict: meta.report?.verdict ?? null,
      };
    })
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

function remove(paths, name) {
  if (!isName(name)) return false;
  let removed = false;
  for (const ext of ['wav', 'json']) {
    const f = path.join(paths.voicesDir, `${name}.${ext}`);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      removed = true;
    }
  }
  return removed;
}

function duration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const d = parseFloat(r.stdout);
  if (!Number.isFinite(d)) throw new Error(`could not read audio from ${file}`);
  return d;
}

/**
 * Levels of a recording, from 100 ms windows: the quiet end (10th percentile)
 * is the room, the loud end (90th) is the voice, and the peak says whether it
 * clipped.
 */
function measure(file, { start = 0, length = null } = {}) {
  const args = ['-hide_banner', '-nostats'];
  if (start) args.push('-ss', String(start));
  if (length) args.push('-t', String(length));
  args.push(
    '-i', file, '-ac', '1', '-ar', '24000',
    '-af', 'asetnsamples=2400,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
    '-f', 'null', '-',
  );
  const r = run('ffmpeg', args);
  const levels = [...String(r.stdout).matchAll(/RMS_level=(-?[\d.]+|-inf)/g)]
    .map((m) => (m[1] === '-inf' ? -120 : parseFloat(m[1])))
    .sort((a, b) => a - b);
  const pick = (q) => (levels.length ? levels[Math.min(levels.length - 1, Math.floor(q * levels.length))] : -120);

  const vol = run('ffmpeg', ['-hide_banner', '-nostats', ...(start ? ['-ss', String(start)] : []),
    ...(length ? ['-t', String(length)] : []), '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const peak = parseFloat((String(vol.stderr).match(/max_volume:\s*(-?[\d.]+)/) || [])[1] ?? '-120');

  return {
    noise: Math.round(pick(0.1) * 10) / 10,
    speech: Math.round(pick(0.9) * 10) / 10,
    peak: Math.round(peak * 10) / 10,
  };
}

/** What a person should do about this reference, in plain words. */
function judge({ length, before, after, sourceDuration }) {
  const warnings = [];
  if (length < IDEAL.floor) warnings.push(`too short (${length.toFixed(1)} s): record at least ${IDEAL.min} s of continuous speech`);
  else if (length < IDEAL.min) warnings.push(`short (${length.toFixed(1)} s): ${IDEAL.min}-${IDEAL.max} s clones noticeably better`);
  if (sourceDuration > IDEAL.max + 5 && length >= IDEAL.max) {
    warnings.push(`trimmed to ${IDEAL.max} s - use --start to pick the liveliest part`);
  }
  if (before.peak >= -0.1) warnings.push('the original clips (peaks at 0 dB): record further from the mic or lower the gain');
  const snr = after.speech - after.noise;
  if (snr < GOOD_SNR) warnings.push(`background noise remains (voice only ${snr.toFixed(0)} dB above it): re-record somewhere quieter`);
  if (before.speech < -40) warnings.push('very quiet original: speak closer to the mic');
  const bad = length < IDEAL.floor || snr < POOR_SNR;
  return { verdict: bad ? 'poor' : warnings.length ? 'usable' : 'good', warnings };
}

/**
 * Turn `input` into the saved voice `name`.
 *
 * @param {object} opts
 * @param {string} opts.input     audio or video file (anything ffmpeg reads)
 * @param {string} opts.name      voice name (NAME_RE)
 * @param {number} [opts.start]   seconds into the input to start from
 * @param {number} [opts.length]  seconds to keep (default: up to 40)
 * @param {'auto'|'strong'|'light'|'off'} [opts.clean]
 * @param {string} [opts.source]  where it came from, for the record
 * @param {string} [opts.refText] transcript of the kept part (optional)
 */
function prepare(paths, { input, name, start = 0, length = null, clean = 'auto', source = null, refText = null }) {
  if (!isName(name)) throw new Error(`invalid name "${name}": use lowercase letters, digits, - or _ (max 40)`);
  if (!fs.existsSync(input)) throw new Error(`file not found: ${input}`);

  const sourceDuration = duration(input);
  const available = Math.max(0, sourceDuration - start);
  const keep = Math.min(length ?? IDEAL.max, available);
  if (keep <= 0) throw new Error(`--start ${start} is past the end of the audio (${sourceDuration.toFixed(1)} s)`);

  const before = measure(input, { start, length: keep });
  const chainName = clean === 'auto' ? (before.speech - before.noise < NOISY_SNR ? 'strong' : 'light') : clean;
  if (!CHAINS[chainName]) throw new Error(`--clean must be auto, strong, light or off`);
  const filters = [...CHAINS[chainName], LOUDNESS].join(',');

  fs.mkdirSync(paths.voicesDir, { recursive: true });
  const out = fileFor(paths, name);
  const tmp = path.join(os.tmpdir(), `qvox-voice-${process.pid}-${name}.wav`);
  const r = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(keep),
    '-i', input, '-af', filters, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', tmp]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr).trim().split('\n').pop()}`);
  fs.renameSync(tmp, out);

  const length_ = duration(out);
  const after = measure(out);
  const verdict = judge({ length: length_, before, after, sourceDuration });
  const report = { chain: chainName, before, after, ...verdict };

  const meta = {
    name,
    source: source ?? path.basename(input),
    created: new Date().toISOString(),
    start,
    duration: Math.round(length_ * 10) / 10,
    refText: refText || null,
    report,
  };
  fs.writeFileSync(path.join(paths.voicesDir, `${name}.json`), JSON.stringify(meta, null, 2));
  return { file: out, ...meta };
}

module.exports = { NAME_RE, IDEAL, isName, resolve, list, remove, prepare, measure, duration, judge };
