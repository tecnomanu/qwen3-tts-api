#!/usr/bin/env node
'use strict';
/**
 * Release helper minimalista (sin deps):
 *   node scripts/release.js patch|minor|major
 * Bumpea package.json, crea commit + tag git. La publicación real (npm/GitHub)
 * la hace el workflow de CI al detectar el tag (ver docs/ARCHITECTURE para auto-release).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const kind = process.argv[2] || 'patch';
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const next = { major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[kind];
if (!next) throw new Error('uso: release.js patch|minor|major');

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('versión ->', next);

try {
  execSync(`git add package.json && git commit -m "chore: release v${next}" && git tag v${next}`, { stdio: 'inherit' });
  console.log(`Tag v${next} creado. Push con:  git push && git push --tags`);
} catch (e) {
  console.error('git falló (¿repo iniciado?):', e.message);
}
