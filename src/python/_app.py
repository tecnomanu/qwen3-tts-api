"""Flask app shared by all backends.

Exposes /health, /v1/models, /v1/audio/speech.

Two text modes:
  - plain text  -> sentence splitting (avoids EOS runaway on long text)
  - tagged text -> inline [emotion] tags. The `instruct` is the BASE voice
    ("system prompt", kept for the whole audio); each [tag] is a sub-prompt
    appended to the base for that segment. A fixed seed keeps the voice stable.
"""
import io
import os
import re
import time
import threading
import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify, Response

_lock = threading.Lock()  # one generation at a time (GPU)
DEFAULT_SEED = 1234

# inline emotion tags -> english instruct fragment (appended to the base voice)
TAG_INSTRUCTS = {
    "laugh": "laughing happily with genuine laughter",
    "laughing": "laughing happily with genuine laughter",
    "happy": "happy and warm",
    "sad": "sounding sad and downcast",
    "cry": "crying, sounding tearful",
    "crying": "crying, sounding tearful",
    "excited": "excited, energetic and very happy",
    "angry": "speaking in an angry tone",
    "whisper": "whispering softly",
    "calm": "calm and relaxed",
    "shout": "shouting loudly",
    "narrator": "in a warm, professional narrator tone",
    "neutral": "",
}


def wav_bytes(audio, sr):
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def trim_silence(a, sr, thr=0.012, pad_ms=80):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    pad = int(sr * pad_ms / 1000)
    return a[max(0, idx[0] - pad): min(len(a), idx[-1] + pad)]


def split_sentences(text, target_len=160):
    parts = re.split(r'(?<=[.!?¡¿\n])\s+', text.strip())
    chunks, cur = [], ""
    for p in parts:
        if not p:
            continue
        if len(cur) + len(p) < target_len:
            cur += (" " if cur else "") + p
        else:
            if cur:
                chunks.append(cur)
            cur = p
    if cur:
        chunks.append(cur)
    return chunks or [text]


def has_tags(text):
    return bool(re.search(r'\[[a-zA-Z]{2,12}\]', text))


def parse_tagged(text):
    """Return a list of (tag_or_None, segment_text)."""
    parts = re.split(r'\[([a-zA-Z]{2,12})\]', text)
    segs = []
    if parts[0].strip():
        segs.append((None, parts[0].strip()))
    for i in range(1, len(parts), 2):
        tag = parts[i].lower()
        seg_text = parts[i + 1].strip() if i + 1 < len(parts) else ""
        if seg_text:
            segs.append((tag, seg_text))
    return segs


def synth_long(backend, text, language, instruct, clone, temperature, gap_ms=120):
    pieces, sr = [], 24000
    for s in split_sentences(text):
        audio, sr = backend.synth(s, language, instruct, clone, temperature)
        pieces.append(audio)
        pieces.append(np.zeros(int(sr * gap_ms / 1000), dtype=np.float32))
    return (np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)), sr


def synth_tagged(backend, text, base_instruct, language, temperature, seed, gap_ms=120):
    """Multi-emotion: base voice (system prompt) + per-segment [tag] sub-prompts."""
    base = base_instruct or "A natural, clear voice."
    pieces, sr = [], 24000
    for tag, seg_text in parse_tagged(text):
        emo = TAG_INSTRUCTS.get(tag, "") if tag else ""
        instruct = f"{base}, {emo}" if emo else base
        audio, sr = backend.synth(seg_text, language=language, instruct=instruct,
                                  temperature=temperature, seed=seed)
        audio = trim_silence(audio, sr)
        pieces.append(audio)
        pieces.append(np.zeros(int(sr * gap_ms / 1000), dtype=np.float32))
    return (np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)), sr


def create_app(backend):
    app = Flask(__name__)

    @app.route("/health")
    def health():
        return jsonify({"ok": True, "backend": backend.name, "loaded": backend.loaded()})

    @app.route("/v1/models")
    def models():
        return jsonify({"data": [{"id": x, "object": "model"} for x in backend.loaded()],
                        "backend": backend.name})

    @app.route("/v1/audio/speech", methods=["POST"])
    def speech():
        data = request.get_json(force=True)
        text = (data.get("input") or data.get("text") or "").strip()
        if not text:
            return jsonify({"error": "missing 'input'"}), 400
        language = data.get("language", "Spanish")
        instruct = data.get("instruct")
        clone = data.get("clone")
        temperature = float(data.get("temperature", 0.7))
        split = data.get("split", True)
        max_tokens = data.get("max_tokens")
        seed = int(data.get("seed", DEFAULT_SEED))
        try:
            with _lock:
                t0 = time.time()
                if has_tags(text) and not clone:
                    audio, sr = synth_tagged(backend, text, instruct, language, temperature, seed)
                    mode = "tagged"
                elif split and not max_tokens:
                    audio, sr = synth_long(backend, text, language, instruct, clone, temperature)
                    mode = "split"
                else:
                    audio, sr = backend.synth(text, language, instruct, clone, temperature, max_tokens)
                    mode = "single"
                print(f"[speech/{mode}] {len(text)}chars -> {len(audio)/sr:.1f}s in "
                      f"{time.time()-t0:.1f}s ({backend.name})", flush=True)
            return Response(wav_bytes(audio, sr), mimetype="audio/wav")
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    return app


def run(backend):
    port = int(os.environ.get("PORT", "5199"))
    app = create_app(backend)
    if os.environ.get("QVOX_WARMUP", "1") == "1":
        try:
            print("--- warmup ---", flush=True)
            backend.synth("Hello.", language="English",
                          instruct="A neutral voice.", max_tokens=192)
            print("--- warmup ok ---", flush=True)
        except Exception as e:
            print(f"--- warmup skip: {e} ---", flush=True)
    print(f"engine[{backend.name}] on :{port}", flush=True)
    app.run(host="0.0.0.0", port=port, threaded=True)
