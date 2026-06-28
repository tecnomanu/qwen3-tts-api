# CLI · `qvox`

| Command | What it does |
|---|---|
| `qvox setup` | Creates config + folders (`~/.qvox`), checks `uv`/`ffmpeg`. |
| `qvox serve [--host H --port P --api-key K]` | Starts engine + API + panel. |
| `qvox speak "text" [opts]` | Generates audio. |
| `qvox status` | Daemon and engine status. |
| `qvox stop` / `qvox restart` | Stop / restart the engine. |
| `qvox config get\|set\|show\|path\|edit` | Manage `config.json`. |
| `qvox models list\|download\|remove\|path` | Manage downloaded models. |
| `qvox update` | `npm install -g` the latest version + restart. |
| `qvox version` / `qvox help` | Version / help. |

### `speak` — options
| Flag | Description |
|---|---|
| `--out, -o <file>` | Output wav (default `~/.qvox/out/speak.wav`). |
| `--instruct "<desc>"` | Voice description (English works best). |
| `--clone <ref.wav>` | Clone a voice from a reference wav (torch backend). |
| `--voice <name>` | Preset voice (aiden, vivian, ryan, sohee). |
| `--lang <language>` | Language (default Spanish). |
| `--temp <n>` | Temperature (default 0.7). |

### Examples
```bash
qvox speak "Hi there, all good?" --voice aiden -o demo.wav
qvox speak "Welcome to the news" --clone ~/voices/anchor.wav -o clone.wav
qvox config set engine.backend torch
qvox config set apiKey a-long-key
qvox models download base          # downloads Qwen3-TTS Base to ~/.qvox/models
```
