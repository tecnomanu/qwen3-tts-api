'use strict';
/**
 * Can this machine run QVox well? Answered before anyone downloads 10 GB of
 * models, so nobody finds out an hour later that their laptop takes a minute
 * per sentence.
 *
 * Numbers are what the models actually need, not wishes: the 1.7B checkpoints
 * sit around 3.5 GB in memory each, and on an M4 Pro a cloned voice renders at
 * about 0.7x real time (a 25 s line in ~17 s). CPU-only works, but roughly an
 * order of magnitude slower.
 */
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const GB = 1024 ** 3;
const NEED = { ramGb: 16, minRamGb: 8, diskGb: 15, node: 18 };

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function nvidiaVramGb() {
  try {
    const outp = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', { stdio: ['ignore', 'pipe', 'ignore'] });
    const mb = Math.max(...String(outp).trim().split('\n').map(Number).filter(Number.isFinite));
    return Number.isFinite(mb) ? mb / 1024 : null;
  } catch {
    return null;
  }
}

function freeDiskGb(dir) {
  try {
    const target = fs.existsSync(dir) ? dir : os.homedir();
    const s = fs.statfsSync(target);
    return (s.bavail * s.bsize) / GB;
  } catch {
    return null;
  }
}

/**
 * @returns {{ checks: Array<{name, ok, level, detail}>, verdict: 'ready'|'slow'|'unsupported', accelerator: string }}
 * level: 'ok' | 'warn' | 'fail'
 */
function checkRequirements(paths) {
  const checks = [];
  const add = (name, level, detail) => checks.push({ name, ok: level === 'ok', level, detail });

  const appleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
  const vram = appleSilicon ? null : nvidiaVramGb();
  let accelerator = 'cpu';
  if (appleSilicon) {
    accelerator = 'apple-silicon';
    add('accelerator', 'ok', 'Apple Silicon (mlx backend, fast)');
  } else if (vram != null) {
    accelerator = 'nvidia';
    add('accelerator', vram >= 8 ? 'ok' : 'warn', `NVIDIA GPU, ${vram.toFixed(0)} GB VRAM${vram >= 8 ? '' : ' (8 GB or more recommended)'}`);
  } else {
    add('accelerator', 'warn', 'no Apple Silicon or NVIDIA GPU found: runs on CPU, about 10x slower than real time');
  }

  const ram = os.totalmem() / GB;
  add('memory', ram >= NEED.ramGb ? 'ok' : ram >= NEED.minRamGb ? 'warn' : 'fail',
    `${ram.toFixed(0)} GB RAM (${NEED.ramGb} GB recommended, ${NEED.minRamGb} GB minimum)`);

  const disk = freeDiskGb(paths?.root);
  if (disk != null) {
    add('disk', disk >= NEED.diskGb ? 'ok' : 'fail', `${disk.toFixed(0)} GB free (models need about ${NEED.diskGb} GB)`);
  }

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('node', nodeMajor >= NEED.node ? 'ok' : 'fail', `Node ${process.versions.node} (${NEED.node}+ required)`);
  add('uv', has('uv') ? 'ok' : 'fail', has('uv') ? 'uv found (manages Python and models)' : 'uv missing: https://docs.astral.sh/uv/');
  add('ffmpeg', has('ffmpeg') ? 'ok' : 'warn',
    has('ffmpeg') ? 'ffmpeg found (voice cloning, mp3/ogg)' : 'ffmpeg missing: required for `voice add` and mp3/ogg (https://ffmpeg.org/download.html)');

  const failed = checks.some((c) => c.level === 'fail');
  const slow = accelerator === 'cpu' || checks.some((c) => c.name === 'memory' && c.level === 'warn');
  return { checks, accelerator, verdict: failed ? 'unsupported' : slow ? 'slow' : 'ready' };
}

module.exports = { checkRequirements, NEED };
