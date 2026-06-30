---
name: qvox-tts
description: >-
  Integrate the QVox / Qwen3-TTS local TTS API into an app — generate speech over HTTP
  (OpenAI-compatible POST /v1/audio/speech), add inline [emotion] tags (laughing, excited,
  sad, whisper, angry, calm, narrator...) to change feeling mid-audio, design a voice from a
  text description, use preset voices, or clone from a reference wav. Use when adding
  text-to-speech / voice generation to a project, wiring an app to a local TTS server, or when
  the user mentions QVox, qvox, Qwen3-TTS, emotion tags for speech, voice design, or voice cloning.
---

# QVox / Qwen3-TTS integration

QVox is a **local** TTS server (Qwen3-TTS) with an **OpenAI-compatible HTTP API**. This skill
is how an agent wires QVox into another app: it covers the request shape, the **emotion-tag**
mechanic, and how the engine auto-selects the voice model.

Default endpoint: `http://127.0.0.1:5111` (configurable; `0.0.0.0` when exposed on a network).
Auth: if an API key is set, send `x-api-key: <key>` **or** `Authorization: Bearer <key>` on
`/v1/*` routes. `/health` is always open. No key set = open (localhost only).

## The one mental model: you don't pick the model, the text does

There is a single endpoint. The engine routes automatically based on what you send — never make
the caller choose a "mode":

| What you send | Model used | Result |
|---|---|---|
| `instruct` (a voice description), no `clone`/`voice` | **VoiceDesign** | voice built from the description (default) |
| text with inline `[tags]`, no `clone` | **VoiceDesign** | same voice, emotion changes per segment |
| `voice` (a preset speaker name) | **CustomVoice** | a named built-in voice |
| `clone` (path to a reference wav) | **Base** | voice cloned from the wav (torch backend only) |

So to add emotional speech you just put `[tags]` in the text and keep one `instruct` as the
base voice. See `references/emotion-tags.md` (portable — paste it into any app or LLM prompt).

## Minimal request

```bash
curl -X POST http://127.0.0.1:5111/v1/audio/speech \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"input":"Good evening. Here are tonight'\''s top stories.",
       "language":"English",
       "instruct":"A professional male news anchor, neutral American accent"}' \
  --output out.wav
```

With emotions (same base voice, feeling changes mid-audio):

```json
{
  "input": "[happy] Good evening. [excited] Here are tonight's top stories.",
  "language": "English",
  "instruct": "A professional male news anchor, neutral American accent"
}
```

JavaScript:

```js
const res = await fetch("http://127.0.0.1:5111/v1/audio/speech", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "YOUR_KEY" },
  body: JSON.stringify({
    input: "[calm] Take a deep breath. [happy] Everything is going to be okay.",
    language: "English",
    instruct: "A soft calm female voice, soothing and slow",
  }),
});
const wav = await res.blob(); // audio/wav
```

Python:

```python
import requests
r = requests.post("http://127.0.0.1:5111/v1/audio/speech",
    headers={"x-api-key": "YOUR_KEY"},
    json={"input": "[narrator] Once upon a time. [whisper] a secret was kept.",
          "language": "English",
          "instruct": "A warm storyteller, gentle and slow"})
open("out.wav", "wb").write(r.content)
```

## Request fields

| field | type | default | note |
|---|---|---|---|
| `input` | string | — | required (alias: `text`). May contain inline `[tags]`. |
| `language` | string | `Spanish` | English, Spanish, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Italian |
| `instruct` | string | — | **base voice** description (the "system prompt"); English works best |
| `voice` | string | — | preset speaker name (needs the CustomVoice model) |
| `clone` | string | — | path to a reference wav → cloning (torch backend only; **disables tags**) |
| `temperature` | number | `0.7` | |
| `seed` | int | `1234` | fixed seed keeps the voice stable across tagged segments |
| `split` | bool | `true` | split long text by sentence (avoids EOS runaway) |
| `max_tokens` | int | — | when set, disables `split` (single-shot) |

## Response

Binary `audio/wav`, plus timing headers useful for logging/diagnostics:
`X-QVox-Mode` (`single`/`split`/`tagged`), `X-QVox-Load-Ms` (model load — `0` if already in
memory), `X-QVox-Synth-Ms` (synthesis only), `X-QVox-Total-Ms`, `X-QVox-Audio-Sec` (audio
duration), `X-QVox-Loaded` (checkpoint loaded this call, if any).

Read `synth_ms / audio_sec` as a realtime factor: < 1.0 = faster than realtime. The first call
after the engine starts pays a one-time model-load cost (shows up in `X-QVox-Load-Ms`).

## Gotchas

- **Tags need VoiceDesign.** If `clone` is set, tags are ignored (cloning uses the Base model).
- **Keep ONE `instruct`** for the whole request — it's the base voice carried across every tagged
  segment. The seed keeps it from drifting. Don't change voice per segment; change emotion.
- **Tag scope**: a `[tag]` applies until the next tag. Unknown tags fall back to the base voice.
- **Cloning is torch-only.** On Apple Silicon (mlx backend) `clone` errors; switch with
  `qvox config set engine.backend torch`.
- **Engine warm-up**: the first request can be slow (model load); subsequent ones are fast.

## Discover what's available at runtime

- `GET /v1/voices` → preset speaker names for the `voice` field.
- `GET /health` → `{ ok, backend, loaded }`.
- `GET /v1/models` → models currently in memory.

## More detail

- `references/emotion-tags.md` — the full, self-contained emotion-tag reference (portable).
- `references/api.md` — complete API surface (all routes, auth, errors, examples).

## Installing this skill

Copy `skills/qvox-tts/` into a skills directory so an agent can load it:

```bash
cp -r skills/qvox-tts ~/.claude/skills/        # user-global
# or, per project:
cp -r skills/qvox-tts /path/to/other-app/.claude/skills/
```
