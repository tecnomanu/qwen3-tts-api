# HTTP API

Base: `http://<host>:<port>` (default `127.0.0.1:5111`).
If `apiKey` is set, send `x-api-key: <key>` or `Authorization: Bearer <key>`
on `/v1/*` and `/api/*` routes. `/health` is always open.

## `POST /v1/audio/speech` (OpenAI-compatible)
JSON body:
| field | type | default | note |
|---|---|---|---|
| `input` | string | — | required (alias: `text`) |
| `language` | string | `Spanish` | |
| `instruct` | string | — | voice description → design |
| `clone` | string | — | path to a reference wav → cloning (torch backend) |
| `voice` | string | — | preset voice |
| `temperature` | number | `0.7` | |
| `split` | bool | `true` | split by sentences (avoids runaway) |

Response: `audio/wav` (binary), plus timing headers used by the panel log:
`X-QVox-Mode` (`single`/`split`/`tagged`), `X-QVox-Load-Ms` (model load, `0` if
already in memory), `X-QVox-Synth-Ms` (synthesis only), `X-QVox-Total-Ms`,
`X-QVox-Audio-Sec` (audio duration), `X-QVox-Loaded` (checkpoint loaded this call, if any).

```bash
curl -X POST http://127.0.0.1:5111/v1/audio/speech \
  -H "content-type: application/json" -H "x-api-key: YOUR_KEY" \
  -d '{"input":"Hello world","instruct":"A warm voice"}' -o out.wav
```

## `POST /v1/audio/speech/stream`

The same body as `/v1/audio/speech`, plus `interval` (seconds of audio per chunk, default
`0.5`). The response is **raw 16-bit little-endian mono PCM with no header**, sent with
chunked transfer encoding:

| header | meaning |
|---|---|
| `X-QVox-Sample-Rate` | samples per second (24000) |
| `X-QVox-Format` | `pcm_s16le_mono` |

There is no header in the body because the length is not known when the first chunk is
sent — that is the whole point of the route. A caller that wants a file keeps using
`/v1/audio/speech`, which is unchanged.

```bash
curl -N -X POST http://127.0.0.1:5111/v1/audio/speech/stream \
  -H "content-type: application/json" -H "x-api-key: YOUR_KEY" \
  -d '{"input":"Hola, ¿cómo va?","voice":"aiden"}' \
  --output - | ffplay -f s16le -ar 24000 -ac 1 -i - -nodisp -autoexit
```

**Why it exists.** `mlx-audio`'s Qwen3-TTS generators already accept `stream=True`; the
non-streaming path collects them with `list()` and returns one waveform, so the caller pays
the entire generation before hearing anything. Measured on one machine, 77-character line,
`Qwen3-TTS-12Hz-1.7B-CustomVoice`:

| | first audio | total |
|---|---|---|
| `/v1/audio/speech` | 3529 ms | 3529 ms |
| `/v1/audio/speech/stream` | **349 ms** | 2530 ms |

Generation runs at ~0.47x realtime — about 480 ms of audio every 225 ms — so a player that
starts on the first chunk never runs dry. Quality is not traded away: the chunks joined and
fed back through whisper transcribe word for word, because the codec decoder keeps 25
frames of left context across chunk boundaries.

Long text is **not** sentence-split here the way `split: true` splits it for
`/v1/audio/speech`. The model is already emitting progressively, so cutting the text on top
of that would only add seams the decoder is busy avoiding.

MLX backend only; the torch backend answers `501`. The engine lock is held for the whole
generation, exactly as it is for the non-streaming route — one generation at a time is the
engine's rule, not this route's choice.

## `POST /v1/warmup`

Loads the checkpoint a coming request will use, so the caller pays the model
load while nobody is waiting. Body: `voice`, `clone` + `ref_text`, `language` —
the same fields that decide who speaks in `/v1/audio/speech`.

**Send the same ones you are about to synthesize with.** A named speaker, a
cloned reference and a bare instruct live in three different multi-gigabyte
checkpoints, and warming one leaves the others exactly as cold as they were.
Warming with `clone` and then asking for a clone measured **0.5 s** on the first
sentence; warming without it, **22 s**.

## Other routes
| Method | Route | Description |
|---|---|---|
| GET | `/health` | daemon ping + engine state |
| GET | `/v1/models` | models loaded in memory |
| POST | `/v1/audio/speech/stream` | raw PCM as it is generated (see above) |
| GET | `/api/status` | full state (for the panel) |
| GET | `/api/config` | current config (keys masked) |
| POST | `/api/config` | config patch `{ "tts.temperature": 0.6 }` |
| POST | `/api/engine/restart` | restart the engine |
