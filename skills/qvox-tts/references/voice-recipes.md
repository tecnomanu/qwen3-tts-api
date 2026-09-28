# Voice recipes — which mode to use, and the `instruct` to use with it

Portable reference: paste it into any app or prompt. Companion to `SKILL.md`
(the routing table) and `emotion-tags.md` (the mid-audio tags).

---

## 1. Pick the mode from the constraint, not the taste

| You need… | Mode | Can you direct the delivery? |
| --- | --- | --- |
| **A specific real person's voice** | `clone` | **No.** Tone comes 100% from the reference. |
| A voice you can direct ("energetic narrator, warm, fast") | `instruct` (VoiceDesign) | **Yes** — that is the whole point. |
| Emotion that changes mid-audio | `instruct` + inline `[tags]` | Yes, per segment. |
| A stable named voice, no description work | `voice` (CustomVoice) | Partially — `instruct` is honored. |

**The trade-off is unavoidable:** cloning gives you the identity and takes away
the direction. `instruct` gives you the direction and takes away the identity.
There is no mode that gives both.

If a project needs *a specific person sounding energetic*, the only lever is
**re-recording the reference** with that energy. Section 3.

---

## 2. `instruct` recipes (VoiceDesign / CustomVoice)

Write the instruct in **English** even when the spoken text is Spanish — the
model was described in English and follows it more reliably. Put the language in
the `language` field, not the instruct.

### Rioplatense / Argentina

```
A warm Argentinian man from Buenos Aires, Rioplatense accent, using "vos".
Conversational and close, like explaining something to a friend at a bar.
Medium-fast pace, natural, never stiff or corporate.
```

```
An Argentinian woman, Rioplatense accent, bright and upbeat. Speaks quickly
with clear articulation and a smile in the voice. Friendly, not saccharine.
```

### Narration / storytelling

```
A calm male narrator, measured pace, low warm register. Documentary voice:
confident, unhurried, letting each sentence land. No excitement.
```

```
An energetic storyteller, fast and animated, varying pitch a lot between
sentences. Sounds genuinely excited about what they are saying.
```

### Product / marketing

```
A friendly product-demo voice, mid-30s, neutral accent, clear and efficient.
Enthusiastic but grounded — sells by being useful, not by being loud.
```

### Institutional / news

```
A professional news anchor, neutral accent, even pacing, minimal emotional
colour. Authoritative and precise.
```

### Tutorial / docs

```
A patient technical instructor. Slightly slower than conversational, clear
consonants, small pauses between steps. Never condescending.
```

**Tuning knobs, in order of effect:** pace → register (high/low) → accent →
emotional colour. Naming a pace ("medium-fast", "unhurried") moves the output
more than any adjective about feeling.

---

## 3. Cloning: the reference IS the performance

A clone reproduces whatever is in the reference — including flatness, hesitation
and room noise. Most "the clone sounds robotic" reports are really "the reference
was a flat recording."

### What makes a good reference

- **25–40 seconds.** Shorter starves the model; longer and the speaker's energy drops.
- **Say something real**, never "this is a test to clone my voice." A recording *about
  recording* produces a self-conscious, monotone clone. This is the single most
  common mistake.
- **Include the target vocabulary** — product names, jargon, proper nouns the
  output will have to say. The clone then pronounces them the speaker's way.
- **Vary the intonation on purpose**: a question, an exclamation, one short
  sentence among long ones. A reference read on one flat line clones as one flat line.
- **No long gaps.** Silence is where room noise lives.
- Stand up while recording. It is audible.

### Cleaning a phone recording

Denoise *before* using it as a reference. This chain took a phone `.ogg` from a
−54 dB noise floor to −64 dB while keeping speech at −17 dB:

```bash
ffmpeg -i raw.ogg -af "highpass=f=95,\
anlmdn=s=0.0012:p=0.006:r=0.008,\
afftdn=nr=32:nf=-45:tn=1,\
equalizer=f=250:t=q:w=1.2:g=-2,\
agate=threshold=0.014:ratio=8:attack=6:release=160,\
loudnorm=I=-18:TP=-2:LRA=9" -ar 24000 -ac 1 reference.wav
```

Verify it worked — measure a gap between phrases, not the whole file:

```bash
ffmpeg -ss <gap> -t 0.4 -i reference.wav -af volumedetect -f null -   # want ≤ −60 dB
```

(Note: `-v error` suppresses `volumedetect` output. Leave it off.)

### Always normalize the output

Clone output ships ~25 dB too quiet (mean −44 dB, peak −30 dB):

```bash
ffmpeg -i raw.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 24000 -ac 1 out.wav
```

`-16 LUFS` is the social-video target. It does not change duration, so timings
measured before normalizing stay valid.

### `ref_text`

The API accepts `ref_text` (what the reference says) and the code comments claim
it raises delivery from 12.9 to 15.8 chars/s. **A/B it — it is not always a win.**
On a Rioplatense reference it produced a *slower*, artifact-ier read than omitting
it. Not exposed by the CLI; send it in the HTTP body.

---

## 3b. Generate the whole script in ONE request, not line by line

The single biggest naturalness win, and the easiest to get wrong. Generating a
narration as N separate one-line requests makes every line start cold and end
dead — the result reads as robotic no matter how good the reference is. One
request for the whole script lets the model carry prosody across sentences and
put the pauses where a narrator would.

```jsonc
// good — one request, engine splits on sentences internally
{ "input": "<the entire 40s script>", "clone": "ref.wav", "split": true, "temperature": 0.85 }
```

Measured on the same reference and script: seven separate line requests sounded
clipped and mechanical; one continuous request produced natural 0.3–0.7 s pauses
between phrases and was accepted immediately.

**Then cut the take to your shot boundaries**, never the reverse. Find the
pauses, cut at their midpoints, and set each shot's duration to its slice:

```bash
ffmpeg -i take.wav -af "silencedetect=n=-45dB:d=0.28" -f null -   # (no -v error)
ffmpeg -y -ss <start> -t <dur> -i take.wav -c:a pcm_s16le -ar 24000 -ac 1 shot-N.wav
```

Contiguous slices reassemble seamlessly — verify by running `silencedetect` on
the final render and checking the pause list still matches the original take.

Also raise `temperature` to ~0.85 for narration; 0.7 is noticeably flatter.

---

## 4. Timing work backwards from the audio

The model sets the pace, not you. For anything time-boxed (video, an ad read),
generate first and measure, then fit the visuals:

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 line.wav
```

Rule of thumb for cloned Spanish: **a 63-character sentence lands around 5.5 s.**
If a line must fit a slot, shorten the line — do not speed up the audio. A
`atempo` bump above ~1.05 is audible as artificial.
