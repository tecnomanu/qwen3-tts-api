# QVox HTTP API — full reference

Base: `http://<host>:<port>` (default `127.0.0.1:5111`). Set `0.0.0.0` to expose on a network.

## Auth

If an API key is configured, send it on every `/v1/*` and `/api/*` request:

- `x-api-key: <key>`, or
- `Authorization: Bearer <key>`

`/health` is always open. With no key set, the server is open (intended for localhost).

## POST /v1/audio/speech

OpenAI-compatible. Returns binary `audio/wav`.

Body:

| field | type | default | note |
|---|---|---|---|
| `input` | string | — | required (alias: `text`); may contain inline `[tags]` |
| `language` | string | `Spanish` | English, Spanish, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Italian |
| `instruct` | string | — | base voice description → VoiceDesign (English works best) |
| `voice` | string | — | preset speaker → CustomVoice model |
| `clone` | string | — | path to a reference wav → cloning (Base model, torch backend); disables tags |
| `temperature` | number | `0.7` | |
| `seed` | int | `1234` | fixed seed → stable voice across tagged segments |
| `split` | bool | `true` | split long text by sentence (avoids EOS runaway) |
| `max_tokens` | int | — | when set, disables `split` (single-shot generation) |

### Routing (server-side, automatic)

1. text has `[tags]` **and** no `clone` → `tagged` mode (VoiceDesign, per-segment emotion).
2. else if `split` and no `max_tokens` → `split` mode (sentence-by-sentence).
3. else → `single` mode (one shot).

Model picked by field: `clone` → Base · `voice` → CustomVoice · otherwise → VoiceDesign.

### Response headers (timing)

| header | meaning |
|---|---|
| `X-QVox-Mode` | `single` / `split` / `tagged` |
| `X-QVox-Load-Ms` | model-load time (`0` if already in memory) |
| `X-QVox-Synth-Ms` | synthesis time only |
| `X-QVox-Total-Ms` | total (load + synth) |
| `X-QVox-Audio-Sec` | duration of the produced audio |
| `X-QVox-Loaded` | checkpoint loaded on this call, if any |

Realtime factor = `Synth-Ms / 1000 / Audio-Sec`; below 1.0 means faster than realtime.

### Errors

`400` `{ "error": "missing 'input'" }` · `503` `{ "error": "engine is down" }` (when autostart
is off) · `500` `{ "error": "<message>" }` (e.g. cloning attempted on the mlx backend).

## Other routes

| Method | Route | Returns |
|---|---|---|
| GET | `/health` | `{ ok, daemon, engine }` (always open) |
| GET | `/v1/models` | models currently loaded in memory |
| GET | `/v1/voices` | `{ voices: [...] }` preset speaker names for `voice` |
| GET | `/api/status` | full state (brand, version, host/port, backend up?, protected?) |
| GET | `/api/models` | install status per role (`installed` / `cached` / `not_installed`, `loaded`) |
| POST | `/api/config` | config patch, e.g. `{ "tts.temperature": 0.6 }` |
| POST | `/api/engine/restart` | restart the inference engine |

## Backends

| Platform | Backend | Notes |
|---|---|---|
| Mac (Apple Silicon) | `mlx` | fast (~0.6–0.9x realtime); **no cloning** (mlx-audio bug) |
| NVIDIA / ROCm / CPU | `torch` | universal, **supports cloning**, slower on MPS |

Force a backend: `qvox config set engine.backend torch` (then it restarts the engine).

## Models (roles)

| role | id | used when |
|---|---|---|
| voicedesign | `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` | `instruct` given (default) |
| custom | `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` | `voice` given |
| base | `Qwen/Qwen3-TTS-12Hz-1.7B-Base` | `clone` given |

Manage with `qvox models list|download <role>|remove <role>`. A model is usable whether it lives
in the local models dir (`installed`) or the HuggingFace cache (`cached`).

## Server lifecycle (CLI)

```bash
qvox setup                          # config + folders + dep check
qvox serve --host 0.0.0.0 --port 5111
qvox config set apiKey a-long-key   # protect when exposed
qvox status
```
