# Arquitectura

```
            ┌──────────────── qvox (Node) ────────────────┐
   CLI ───► │  cli/ ─ comandos (serve, speak, models...)   │
            │  server/ ─ HTTP + panel + auth (api key)     │
            │  engine/ ─ administra el worker Python        │
            │  core/ ─ brand, paths, config (archivo), log │
            └───────────────────┬──────────────────────────┘
                                 │ HTTP localhost (puerto interno)
            ┌───────────────────▼──────────────────────────┐
            │  motor (Python, via uv)                       │
            │  _app.py ─ Flask + split por frases           │
            │  backends/ ─ mlx | torch (intercambiables)    │
            └───────────────────────────────────────────────┘
```

## Principios (SOLID)
- **SRP**: `core/paths` resuelve rutas; `core/config` el estado; `engine/*` el proceso Python;
  `server/*` el transporte; cada `cli/commands/*` una acción.
- **OCP/DIP**: `_app.py` depende de la *interfaz* `TTSBackend` (`backends/base.py`), no de MLX
  ni Torch. Agregar un backend nuevo = una clase, sin tocar la app.
- **Composition root**: `core/context.js` arma e inyecta `ctx` (brand, paths, config, logger).

## Decisiones
- **Node administra, Python infiere.** Encaja con `npm install -g` y aísla las deps pesadas de ML.
- **uv** corre los scripts Python con deps declaradas inline (sin venvs manuales).
- **Sin DB**: `config.json` en `~/.qvox`. Precedencia: env > archivo > defaults.
- **Nombre en una constante** (`src/brand.js`). Todo deriva de ahí.

## APX-compatible
El daemon expone HTTP simple con API key, así se puede registrar como runtime/herramienta
en APX más adelante sin cambios en el core.

## Deploy
- **Mac**: nativo (sin Docker — Docker en Mac no accede a MPS/Metal). Backend mlx.
- **VPS NVIDIA**: Docker con CUDA. Backend torch. Vuela.
- **VPS Radeon (RDNA1/5700XT)**: nativo/bare-metal con ROCm (no oficial, sin flash-attn). Backend torch.
