'use strict';
/**
 * Manages the Python worker lifecycle (spawn / health / stop / restart).
 * Node does not run inference: it delegates to the Python process via uv.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PythonBridge } = require('./PythonBridge');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class EngineManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.cfg = ctx.config.all();
    this.port = this.cfg.engine.port;
    this.bridge = new PythonBridge({ port: this.port });
    this.proc = null;
  }

  /** Resolve 'auto' -> mlx on Apple Silicon, torch everywhere else. */
  resolveBackend() {
    const b = this.cfg.engine.backend;
    if (b && b !== 'auto') return b;
    const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
    return isAppleSilicon ? 'mlx' : 'torch';
  }

  _entryScript() {
    const backend = this.resolveBackend();
    return path.join(this.ctx.paths.pythonDir, `engine_${backend}.py`);
  }

  _spawnEnv() {
    const c = this.cfg;
    return {
      ...process.env,
      PORT: String(this.port),
      [`${this.ctx.brand.envPrefix}_BACKEND`]: c.engine.backend,
      QVOX_MODELS_DIR: this.ctx.paths.modelsDir,
      QVOX_MODEL_VOICEDESIGN: c.models.voicedesign,
      QVOX_MODEL_BASE: c.models.base,
      QVOX_MODEL_CUSTOM: c.models.custom,
      QVOX_WARMUP: c.engine.warmup ? '1' : '0',
      HF_HUB_ENABLE_HF_TRANSFER: c.hf.enableHfTransfer ? '1' : '0',
      ...(c.hf.token ? { HF_TOKEN: c.hf.token } : {}),
    };
  }

  async isUp() {
    try {
      await this.bridge.health();
      return true;
    } catch {
      return false;
    }
  }

  /** Start the worker if not running and wait for /health to respond. */
  async start({ wait = true, timeoutMs = 180000 } = {}) {
    if (await this.isUp()) {
      this.ctx.logger.info('engine already running on :' + this.port);
      return;
    }
    const cmd = this.cfg.engine.pythonCmd === 'uv' ? 'uv' : this.cfg.engine.pythonCmd;
    const args = cmd === 'uv' ? ['run', this._entryScript()] : [this._entryScript()];
    const logFile = path.join(this.ctx.paths.logsDir, 'engine.log');
    const logFd = fs.openSync(logFile, 'a');

    this.ctx.logger.info(`starting engine: ${cmd} ${args.join(' ')}`);
    this.proc = spawn(cmd, args, {
      env: this._spawnEnv(),
      stdio: ['ignore', logFd, logFd],
      detached: true,
    });
    fs.writeFileSync(this.ctx.paths.pidFile, String(this.proc.pid));
    this.proc.unref();

    if (!wait) return;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isUp()) {
        this.ctx.logger.ok('engine ready on :' + this.port);
        return;
      }
      await sleep(1500);
    }
    throw new Error(`engine did not respond within ${timeoutMs}ms (see ${logFile})`);
  }

  async stop() {
    let pid = null;
    try {
      pid = Number(fs.readFileSync(this.ctx.paths.pidFile, 'utf8'));
    } catch {
      /* no pid file */
    }
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        this.ctx.logger.ok('engine stopped (pid ' + pid + ')');
      } catch {
        this.ctx.logger.warn('could not kill pid ' + pid + ' (already dead?)');
      }
      try {
        fs.unlinkSync(this.ctx.paths.pidFile);
      } catch {
        /* ignore */
      }
    } else {
      this.ctx.logger.warn('no engine registered');
    }
  }

  async restart() {
    await this.stop();
    await sleep(1000);
    await this.start();
  }
}

module.exports = { EngineManager };
