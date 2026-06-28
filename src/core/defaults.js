'use strict';
/** Configuración por defecto. Todo se puede pisar por config.json o env. */
module.exports = {
  // --- servidor ---
  host: '127.0.0.1', // localhost por defecto; 0.0.0.0 para exponer en red (VPS)
  port: 5111,
  apiKey: null, // null = sin auth (solo localhost). Poné una clave para exponer en red.

  // --- motor de inferencia (worker python) ---
  engine: {
    backend: 'auto', // 'auto' | 'mlx' | 'torch' | 'cpu'
    port: 5199, // puerto interno del worker python (no se expone)
    pythonCmd: 'uv', // 'uv' (recomendado) o 'python3'
    warmup: true,
    autostart: true, // el server levanta el worker solo
  },

  // --- modelos ---
  models: {
    // ids o paths locales por rol
    voicedesign: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
    base: 'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    custom: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    defaultRole: 'voicedesign',
  },

  // --- generación ---
  tts: {
    language: 'Spanish',
    temperature: 0.7,
    splitSentences: true, // evita el runaway de EOS en textos largos
    defaultVoice: 'aiden',
  },

  // --- huggingface ---
  hf: {
    token: null, // se puede setear para descargas rápidas (evita throttle anónimo)
    enableHfTransfer: true,
  },
};
