# Architecture

```
            ┌──────────────── qvox (Node) ────────────────┐
   CLI ───► │  cli/ ─ commands (serve, speak, models...)   │
            │  server/ ─ HTTP + panel + auth (api key)     │
            │  engine/ ─ manages the Python worker         │
            │  core/ ─ brand, paths, config (file), logger │
            └───────────────────┬──────────────────────────┘
                                 │ HTTP localhost (internal port)
            ┌───────────────────▼──────────────────────────┐
            │  engine (Python, via uv)                      │
            │  _app.py ─ Flask + sentence splitting         │
            │  backends/ ─ mlx | torch (interchangeable)    │
            └───────────────────────────────────────────────┘
```

## Principles (SOLID)
- **SRP**: `core/paths` resolves paths; `core/config` holds state; `engine/*` the Python process;
  `server/*` transport; each `cli/commands/*` one action.
- **OCP/DIP**: `_app.py` depends on the `TTSBackend` *interface* (`backends/base.py`), not on MLX
  or Torch. Adding a new backend = one class, without touching the app.
- **Composition root**: `core/context.js` builds and injects `ctx` (brand, paths, config, logger).

## Decisions
- **Node manages, Python infers.** Fits `npm install -g` and isolates the heavy ML deps.
- **uv** runs the Python scripts with inline-declared deps (no manual venvs).
- **No DB**: `config.json` in `~/.qvox`. Precedence: env > file > defaults.
- **Name in a single constant** (`src/brand.js`). Everything derives from it.

## APX-compatible
The daemon exposes simple HTTP with an API key, so it can be registered as an APX
runtime/tool later without changes to the core.

## Deploy
- **Mac**: native (no Docker — Docker on Mac can't access MPS/Metal). mlx backend.
- **NVIDIA VPS**: Docker with CUDA. torch backend. Fast.
- **Radeon VPS (RDNA1/5700XT)**: bare-metal with ROCm (unofficial, no flash-attn). torch backend.
