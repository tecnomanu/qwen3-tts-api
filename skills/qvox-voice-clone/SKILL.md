---
name: qvox-voice-clone
description: >-
  Install QVox (local Qwen3-TTS) and clone a voice from a recording — a phone voice note, a
  video, a studio take or a URL — then use it by name. Checks the machine first, cleans and
  trims the reference, reports whether it will clone well, and tests it. Use when someone wants
  to set up QVox, "clone my voice", "use this recording as a voice", "make a voice from this
  audio", "clonar mi voz", "hacer una voz con este audio", or asks why a cloned voice sounds bad.
---

# QVox voice cloning

The whole mechanic is one command: `qvox voice add <name> <recording>` turns any recording
into a reference the model clones well (measured, cleaned only as needed, cut to 25-40 s,
normalised) and saves it under a name. After that the voice is used by name everywhere:
`qvox speak --clone <name>`, `"clone": "<name>"` in the API, the web panel.

The human-facing tutorial is `docs/VOICE-CLONING.md` in the QVox repo, also served by the
panel at `http://127.0.0.1:5111/guide.html`. Point people there; this file is for you.

## 0. Consent — ask, every time

Cloning copies a real person's voice. Before running `voice add`, **ask the user** whether
the voice is theirs, or whether its owner gave permission (for a synthetic voice from another
service: whether its licence allows reuse). Only pass `--consent` after they say yes. Do not
clone a voice to impersonate someone or to deceive, whatever the stated reason.

## 1. Can this machine run it?

```bash
qvox setup        # if qvox is not installed yet, see step 2 first
```

It prints `[ok]`, `[!!]` (works, but slowly) or `[--]` (missing) per requirement and stops if
the machine cannot run it. Tell the user plainly before anything is downloaded:

| | Recommended | Works, slowly | Not enough |
|---|---|---|---|
| Hardware | Apple Silicon (M1+) or NVIDIA GPU 8 GB+ VRAM | other CPUs (~10x slower than real time) | — |
| Memory | 16 GB | 8 GB | < 8 GB |
| Disk | 15 GB free | — | < 15 GB |
| Software | Node 18+, uv, ffmpeg | — | no Node 18 / no uv |

On CPU-only machines say so up front: a 30 s narration can take minutes.

## 2. Install (if needed)

```bash
# prerequisites
brew install uv ffmpeg            # macOS   (Linux: curl -LsSf https://astral.sh/uv/install.sh | sh; apt install ffmpeg)
npm install -g qwen3-tts-api      # installs the `qvox` command
qvox setup                        # config + folders + the requirements check above
qvox serve                        # API + panel on http://127.0.0.1:5111 (downloads models on first use)
```

Optional: `yt-dlp` if the recording is a URL.

## 3. Get a recording

Ask which of these the user has, and give the matching advice (details in the tutorial):

- **Record now (best)** — 25-40 s, quiet room, phone ~20 cm away, standing, talking to
  someone. Say something real, with a question and an exclamation; never "this is a test to
  clone my voice" (it clones as a self-conscious monotone). The tutorial has a ~35 s text to
  read in Spanish and English.
- **An existing file** — voice note (.ogg/.m4a), podcast, video audio. Phone notes are fine;
  `voice add` cleans them.
- **A URL** of their own content — `voice add` downloads it with yt-dlp.
- **A synthetic voice** they licensed — generate 30-40 s of varied speech and add that file.

## 4. Add it

```bash
qvox voice add <name> <file|url> --consent [--start s] [--length s] [--clean auto|strong|light|off]
```

`name`: lowercase letters, digits, `-`, `_`. Use `--start` when the good part is not at the
beginning. Read the report back to the user:

- **GOOD** — use it.
- **USABLE** — works; relay the warnings (they say what would improve it).
- **POOR** — it will clone badly. Relay the warning and ask for a better recording. Do not
  paper over it by trying settings: noise, clipping and flat delivery are fixed at the source.

`--clean auto` decides by voice-to-noise ratio (strong chain for phone notes, light filter for
clean takes). Only force `--clean` if the user asks or the auto choice clearly misjudged.

## 5. Test and use

```bash
qvox voice test <name> ["text"] [--lang Spanish]   # -> ~/.qvox/out/voice-<name>.wav, normalised
qvox speak "text" --clone <name> -o out.wav
curl -X POST http://127.0.0.1:5111/v1/audio/speech -H "content-type: application/json" \
  -d '{"input":"text","language":"Spanish","clone":"<name>"}' -o out.wav
```

Send the audio file to the user to listen to; you cannot judge it by ear. For integrating the
voice into an app (request fields, emotion tags, timing), use the `qvox-tts` skill.

## Gotchas

- **A clone cannot be directed.** `instruct` and `[emotion]` tags are ignored with `clone`;
  the delivery comes only from the reference. Livelier voice = livelier recording.
- **Raw clone output is ~25 dB quiet.** `voice test` normalises; for API output run
  `ffmpeg -i raw.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" out.wav` before mixing.
- **One request for a whole script** sounds natural; one request per line sounds clipped.
- **Engine stuck** (requests time out, `engine: down` in `/health`, log says port 5199 in use):
  a previous engine process is hanging on the port — find it with `lsof -iTCP:5199 -sTCP:LISTEN`,
  stop it, and the daemon starts a fresh one on the next request.
- `qvox voice list` / `qvox voice remove <name>` / `qvox voice path` manage saved voices; a
  24 kHz mono wav dropped into that folder also works by its file name.
