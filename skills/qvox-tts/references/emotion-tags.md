# QVox emotion tags — portable reference

Self-contained. Paste this into any app, prompt, or another LLM's context to teach it how to
add emotion to QVox / Qwen3-TTS speech. No QVox-specific tooling required — it's just a
convention inside the `input` text of `POST /v1/audio/speech`.

## How it works

- Write `[tag]` inline in the text. The emotion **applies from that point until the next tag**.
- The request's `instruct` is the **base voice** (kept for the whole audio). Each `[tag]` is a
  short sub-prompt appended to the base voice **for that segment only** — so the voice stays the
  same, only the feeling changes.
- A fixed `seed` (default `1234`) keeps the voice stable across segments. Keep it fixed.
- Tags are **ignored when cloning** (`clone` set): cloning uses a different model.
- Text with no tags is generated plainly (no emotion shifts). Mixing is fine: untagged text at
  the start uses the base voice, then tags take over.

## Available tags

| Tag | Feeling | Aliases |
|---|---|---|
| `[happy]` | happy and warm | |
| `[excited]` | excited, energetic, very happy | |
| `[sad]` | sad and downcast | |
| `[laughing]` | genuine laughter | `[laugh]` |
| `[crying]` | tearful | `[cry]` |
| `[angry]` | angry tone | |
| `[whisper]` | whispering softly | |
| `[shout]` | shouting loudly | |
| `[calm]` | calm and relaxed | |
| `[narrator]` | warm, professional narrator | |
| `[neutral]` | resets to the plain base voice | |

Tag names are case-insensitive and matched as `[a-zA-Z]{2,12}`. An **unknown** tag falls back to
the base voice (no error).

## Examples

Single shift:

```
[happy] Welcome back to the show! [calm] Today we slow things down a bit.
```

News read that warms up then drops to a whisper for a teaser:

```
A professional male news anchor, neutral American accent     <- instruct (base voice)

Good evening. [excited] We have breaking news tonight. [whisper] You won't believe this one.
```

Storytelling:

```
A warm storyteller, gentle and slow                          <- instruct (base voice)

[narrator] Once upon a time, in a faraway town. [sad] A child who could not sleep. [happy] Until one morning, everything changed.
```

## Rules of thumb

1. **One `instruct` per request** — it's the voice. Change emotion with tags, never the voice.
2. Put a tag **right before** the words it should color; it stays until the next tag.
3. Use `[neutral]` to return to the plain base voice after an emotional stretch.
4. Tags add no meaningful generation cost — the extra time you see is just from longer audio.
5. To pick tags programmatically: detect intent (exclamation → `[excited]`, "..." soft line →
   `[whisper]`, sad context → `[sad]`) and inject the tag before that clause.

## Request shape (for reference)

```json
{
  "input": "[happy] Hi! [whisper] Come closer.",
  "language": "English",
  "instruct": "A friendly podcast host, warm casual tone",
  "seed": 1234
}
```

`POST` it to `http://<host>:<port>/v1/audio/speech` → `audio/wav`.
