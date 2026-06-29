# AGENTS.md — conventions for working on QVox (`qwen3-tts-api`)

Read this before changing code. These are hard rules for any contributor or agent.

## Icons & emojis — STRICT
- **0 emojis. Anywhere.** Not in the UI, not in code, comments, logs, docs, commit
  messages or strings.
- **Web UI: always [Phosphor Icons](https://phosphoricons.com/)** via `<i class="ph ph-<name>"></i>`
  (loaded in `index.html`). Never an emoji, never another icon set.
- **Terminal / CLI output:** plain ASCII only (e.g. `[ok]`, `[--]`, `UP`, `DOWN`).
  Phosphor is a web font and cannot render in a terminal, so CLI uses words, not glyphs.
- When you need a new icon, pick the closest Phosphor name and use `ph ph-<name>`.

## Language
- **All code, comments, identifiers, docs, UI text and commit messages in English.**

## Naming / brand
- The product name lives in ONE place: `src/brand.js` (`CODENAME`). Everything derives
  from it (CLI command, `~/.qvox` data dir, `QVOX_*` env vars, panel title). Don't hardcode
  the name elsewhere. (Exception: the `bin` key in `package.json`, which npm needs static.)

## Architecture (keep it this way)
- **Node manages, Python infers.** Node = CLI + HTTP API + web panel + engine lifecycle.
  Python (run via `uv`) = inference, behind the `TTSBackend` interface (`src/python/backends/`).
- **Backends are interchangeable:** `mlx` (Apple Silicon, fast; no cloning) and `torch`
  (universal: CUDA/ROCm/MPS/CPU; supports cloning). `auto` picks one by platform.
- **No database.** All config is a JSON file in `~/.qvox` (`src/core/config.js`).
  Precedence: env > config.json > defaults.
- **Zero runtime npm dependencies** on the Node side (built-in `http`, custom arg parser).
  Keep it that way unless there is a strong reason.
- Shared logic goes in `src/core/` (e.g. `modelStatus.js`) and is reused by CLI and API (DRY).

## Releases
- Bump `package.json`, commit `chore: release vX.Y.Z`, tag `vX.Y.Z`, push the tag.
  CI (`.github/workflows/release.yml`) creates the GitHub Release (and publishes to npm if
  `NPM_TOKEN` is set).
