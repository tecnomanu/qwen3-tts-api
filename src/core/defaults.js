'use strict';
/** Default configuration. Everything can be overridden via config.json or env. */
module.exports = {
  // --- server ---
  host: '127.0.0.1', // localhost by default; use 0.0.0.0 to expose on the network (VPS)
  port: 5111,
  apiKey: null, // null = no auth (localhost only). Set a key to expose on the network.

  // --- inference engine (python worker) ---
  engine: {
    backend: 'auto', // 'auto' | 'mlx' | 'torch' | 'cpu'
    port: 5199, // internal port of the python worker (not exposed)
    pythonCmd: 'uv', // 'uv' (recommended) or 'python3'
    warmup: true,
    autostart: true, // the server boots the worker automatically
  },

  // --- models ---
  models: {
    // ids or local paths per role
    voicedesign: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
    base: 'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    custom: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    defaultRole: 'voicedesign',
  },

  // --- generation ---
  tts: {
    language: 'Spanish',
    temperature: 0.7,
    splitSentences: true, // avoids the EOS runaway on long text
    defaultVoice: 'aiden',
  },

  // --- huggingface ---
  hf: {
    token: null, // set it for fast downloads (avoids anonymous throttling)
    enableHfTransfer: true,
  },
};
