# API HTTP

Base: `http://<host>:<port>` (default `127.0.0.1:5111`).
Si `apiKey` está seteada, mandá `x-api-key: <clave>` o `Authorization: Bearer <clave>`
en las rutas `/v1/*` y `/api/*`. `/health` siempre abierto.

## `POST /v1/audio/speech` (compatible OpenAI)
Body JSON:
| campo | tipo | default | nota |
|---|---|---|---|
| `input` | string | — | requerido (alias: `text`) |
| `language` | string | `Spanish` | |
| `instruct` | string | — | descripción de voz → diseño |
| `clone` | string | — | ruta a wav de referencia → clonación (backend torch) |
| `voice` | string | — | voz preset |
| `temperature` | number | `0.7` | |
| `split` | bool | `true` | divide por frases (evita runaway) |

Respuesta: `audio/wav` (binario).

```bash
curl -X POST http://127.0.0.1:5111/v1/audio/speech \
  -H "content-type: application/json" -H "x-api-key: TU_CLAVE" \
  -d '{"input":"Hola mundo","instruct":"A warm Argentine voice"}' -o out.wav
```

## Otras rutas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | ping del daemon + estado del motor |
| GET | `/v1/models` | modelos cargados en memoria |
| GET | `/api/status` | estado completo (para el panel) |
| GET | `/api/config` | config actual (claves enmascaradas) |
| POST | `/api/config` | patch de config `{ "tts.temperature": 0.6 }` |
| POST | `/api/engine/restart` | reinicia el motor |
