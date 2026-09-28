# CLI · `qvox`

| Command | What it does |
|---|---|
| `qvox setup` | Checks the requirements (hardware, RAM, disk, Node/uv/ffmpeg), creates config + folders (`~/.qvox`). |
| `qvox serve [--host H --port P --api-key K]` | Starts engine + API + panel. |
| `qvox speak "text" [opts]` | Generates audio. |
| `qvox status` | Daemon and engine status. |
| `qvox stop` / `qvox restart` | Stop / restart the engine. |
| `qvox config get\|set\|show\|path\|edit` | Manage `config.json`. |
| `qvox models list\|download\|remove\|path` | Manage downloaded models. |
| `qvox voice add\|test\|list\|remove\|path` | Cloned voices — see below and [VOICE-CLONING.md](VOICE-CLONING.md). |
| `qvox update` | `npm install -g` the latest version + restart. |
| `qvox version` / `qvox help` | Version / help. |

### `speak` — options
| Flag | Description |
|---|---|
| `--out, -o <file>` | Output wav (default `~/.qvox/out/speak.wav`). |
| `--instruct "<desc>"` | Voice description (English works best). |
| `--clone <name\|ref.wav>` | Clone a saved voice (`qvox voice add`) or a reference wav. |
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

### `voice` — cloned voices
| Command | Description |
|---|---|
| `qvox voice add <name> <file\|url>` | Measure, clean, trim (25-40 s) and normalise a recording; save it as `<name>`. Reports GOOD / USABLE / POOR. |
| `qvox voice test <name> ["text"]` | Speak with it; saves a normalised wav to `~/.qvox/out/voice-<name>.wav`. |
| `qvox voice list` | Saved voices: length, verdict, source. |
| `qvox voice remove <name>` | Delete a saved voice. |
| `qvox voice path` | The voices folder. |

`add` options: `--start <s>` / `--length <s>` pick the part to keep; `--clean auto|strong|light|off`
(default auto: decided by voice-to-noise ratio); `--text "<transcript>"` stores what the kept
part says; `--consent` confirms you have the right to use the voice (asked interactively otherwise).
A URL needs [yt-dlp](https://github.com/yt-dlp/yt-dlp).
