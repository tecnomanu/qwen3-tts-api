# CLI · `qvox`

| Comando | Qué hace |
|---|---|
| `qvox setup` | Crea config + carpetas (`~/.qvox`), verifica `uv`/`ffmpeg`. |
| `qvox serve [--host H --port P --api-key K]` | Levanta motor + API + panel. |
| `qvox speak "texto" [opts]` | Genera audio. |
| `qvox status` | Estado del daemon y motor. |
| `qvox stop` / `qvox restart` | Detiene / reinicia el motor. |
| `qvox config get\|set\|show\|path\|edit` | Gestiona `config.json`. |
| `qvox models list\|download\|remove\|path` | Gestiona modelos descargados. |
| `qvox update` | `npm install -g` la última versión + reinicia. |
| `qvox version` / `qvox help` | Versión / ayuda. |

### `speak` — opciones
| Flag | Descripción |
|---|---|
| `--out, -o <archivo>` | Salida wav (default `~/.qvox/out/speak.wav`). |
| `--instruct "<desc>"` | Descripción de la voz (inglés rinde mejor). |
| `--clone <ref.wav>` | Clona una voz desde un wav de referencia (backend torch). |
| `--voice <nombre>` | Voz preset (aiden, vivian, ryan, sohee). |
| `--lang <idioma>` | Idioma (default Spanish). |
| `--temp <n>` | Temperatura (default 0.7). |

### Ejemplos
```bash
qvox speak "Hola che, ¿todo bien?" --voice aiden -o demo.wav
qvox speak "Bienvenidos al noticiero" --clone ~/voces/locutor.wav -o clon.wav
qvox config set engine.backend torch
qvox config set apiKey una-clave-larga
qvox models download base          # baja Qwen3-TTS Base a ~/.qvox/models
```
