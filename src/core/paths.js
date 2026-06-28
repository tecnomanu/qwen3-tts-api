'use strict';
/**
 * Resuelve TODAS las rutas a partir de brand.dataDir.
 * Permite override de la carpeta raíz por env ($QVOX_HOME) o config.
 * Una sola responsabilidad: dónde vive cada cosa.
 */
const path = require('path');
const fs = require('fs');
const { brand } = require('../brand');

function resolveRoot(override) {
  return override || brand.dataDir;
}

function buildPaths(rootOverride) {
  const root = resolveRoot(rootOverride);
  return {
    root, // ~/.qvox
    configFile: path.join(root, 'config.json'),
    modelsDir: path.join(root, 'models'), // pesos descargados
    voicesDir: path.join(root, 'voices'), // refs de voces clonadas (wav 24k)
    outDir: path.join(root, 'out'), // audios generados desde CLI
    logsDir: path.join(root, 'logs'),
    runDir: path.join(root, 'run'), // pid/sockets
    pidFile: path.join(root, 'run', 'engine.pid'),
    pythonDir: path.join(__dirname, '..', 'python'), // código del worker (en el paquete)
  };
}

/** Crea las carpetas de datos si no existen (idempotente). */
function ensureDirs(p) {
  for (const dir of [p.root, p.modelsDir, p.voicesDir, p.outDir, p.logsDir, p.runDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

module.exports = { buildPaths, ensureDirs, resolveRoot };
