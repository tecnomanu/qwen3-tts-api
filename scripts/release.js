#!/usr/bin/env node
'use strict';
/**
 * Minimal release helper (no deps):
 *   node scripts/release.js patch|minor|major
 * Bumps package.json, creates a git commit + tag. The actual publish (npm/GitHub)
 * is done by CI when it detects the tag (see .github/workflows/release.yml).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const kind = process.argv[2] || 'patch';
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const next = { major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[kind];
if (!next) throw new Error('usage: release.js patch|minor|major');

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('version ->', next);

try {
  execSync(`git add package.json && git commit -m "chore: release v${next}" && git tag v${next}`, { stdio: 'inherit' });
  console.log(`Tag v${next} created. Push with:  git push && git push --tags`);
} catch (e) {
  console.error('git failed (repo initialized?):', e.message);
}
