'use strict';
/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  ÚNICA FUENTE DEL NOMBRE.                                              │
 * │  Cambiá CODENAME y se propaga a: comando CLI, carpeta de datos,       │
 * │  prefijo de variables de entorno, títulos del panel, etc.            │
 * │                                                                       │
 * │  (Excepción: el nombre del binario en package.json -> "bin" es       │
 * │   estático por requerimiento de npm. Si renombrás, actualizá también  │
 * │   la clave "bin" de package.json.)                                    │
 * └──────────────────────────────────────────────────────────────────────┘
 */
const os = require('os');
const path = require('path');

const CODENAME = 'qvox'; // <-- cambialo acá

const ENV = CODENAME.toUpperCase();

const brand = {
  /** código corto, todo en minúscula */
  code: CODENAME,
  /** comando de terminal */
  cli: CODENAME,
  /** nombre visible (personalizable) */
  displayName: 'qvox',
  /** descripción corta para help/panel */
  tagline: 'Servidor local de TTS (Qwen3-TTS) con voces clonables',
  /** prefijo de variables de entorno: QVOX_HOST, QVOX_PORT, QVOX_API_KEY... */
  envPrefix: ENV,
  /** carpeta raíz de datos/config/modelos (override con $QVOX_HOME) */
  dataDir: process.env[`${ENV}_HOME`] || path.join(os.homedir(), `.${CODENAME}`),
  /** nombre del repo (para SEO/clone) — separado del codename a propósito */
  repo: 'qwen3-tts-api',
};

/** Helper: nombre de var de entorno con el prefijo de marca. env('PORT') -> 'QVOX_PORT' */
function env(name) {
  return `${brand.envPrefix}_${name}`;
}

module.exports = { brand, CODENAME, env };
