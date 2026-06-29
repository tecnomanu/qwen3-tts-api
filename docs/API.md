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

## Other routes
| Method | Route | Description |
|---|---|---|
| GET | `/health` | daemon ping + engine state |
| GET | `/v1/models` | models loaded in memory |
| GET | `/api/status` | full state (for the panel) |
| GET | `/api/config` | current config (keys masked) |
| POST | `/api/config` | config patch `{ "tts.temperature": 0.6 }` |
| POST | `/api/engine/restart` | restart the engine |
