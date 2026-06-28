# qwen3-tts-api · `qvox`

Servidor/daemon **local** de TTS basado en **Qwen3-TTS**, con **API HTTP** (estilo OpenAI),
**panel web**, **CLI** y **voces clonables**. Corre en `localhost` (Mac) o expuesto en red
(`0.0.0.0`, VPS) con **API key** opcional. Sin base de datos: todo se configura por archivo.

> El comando se llama **`qvox`**. El nombre vive en una sola constante (`src/brand.js`),
> cambialo ahí y se propaga a comando, carpeta de datos (`~/.qvox`), env vars y panel.

## Instalación

```bash
npm install -g qwen3-tts-api      # instala el comando `qvox`
qvox setup                        # crea config + carpetas, verifica deps
qvox serve                        # levanta API + panel en http://127.0.0.1:5111
```

Requisitos: **Node ≥ 18** y **[uv](https://docs.astral.sh/uv/)** (gestiona Python/modelos solo).
`ffmpeg` opcional (conversión de audio).

## Uso rápido

```bash
qvox speak "Buenas, ¿cómo andás?" --voice aiden --out demo.wav
qvox speak "Hola che" --clone /ruta/locutor.wav --out clon.wav   # clonar una voz
qvox serve --host 0.0.0.0 --port 5111                            # exponer en red
qvox config set apiKey mi-clave                                  # proteger con api key
qvox models list
qvox status
```

## Backends (auto-detección)

| Plataforma | Backend | Notas |
|---|---|---|
| Mac (Apple Silicon) | **mlx** | Rápido (~0.85x tiempo real). Clonación no soportada aún (bug mlx-audio). |
| NVIDIA / ROCm / CPU | **torch** | Universal, **soporta clonación**. Más lento en MPS. |

Forzar: `qvox config set engine.backend torch`.

## API (compatible OpenAI)

```bash
curl -X POST http://127.0.0.1:5111/v1/audio/speech \
  -H "content-type: application/json" \
  -H "x-api-key: TU_CLAVE" \
  -d '{"input":"Hola mundo","language":"Spanish","instruct":"A warm Argentine voice"}' \
  -o out.wav
```

Ver [docs/API.md](docs/API.md), [docs/CLI.md](docs/CLI.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licencia
MIT · tecnomanu. Modelos Qwen3-TTS: Apache-2.0 (Alibaba).
