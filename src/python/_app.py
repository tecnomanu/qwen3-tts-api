"""App Flask compartida por todos los backends.

Expone /health, /v1/models, /v1/audio/speech (con split por frases para evitar
el runaway de EOS en textos largos). El backend se inyecta.
"""
import io
import os
import re
import time
import threading
import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify, Response

_lock = threading.Lock()  # 1 generación a la vez (GPU)


def wav_bytes(audio, sr):
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


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


def synth_long(backend, text, language, instruct, clone, temperature, gap_ms=120):
    pieces, sr = [], 24000
    for s in split_sentences(text):
        audio, sr = backend.synth(s, language, instruct, clone, temperature)
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
        try:
            with _lock:
                t0 = time.time()
                if split and not max_tokens:
                    audio, sr = synth_long(backend, text, language, instruct, clone, temperature)
                else:
                    audio, sr = backend.synth(text, language, instruct, clone, temperature, max_tokens)
                print(f"[speech] {len(text)}chars -> {len(audio)/sr:.1f}s in "
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
            backend.synth("Hola.", language="Spanish",
                          instruct="A neutral voice.", max_tokens=192)
            print("--- warmup ok ---", flush=True)
        except Exception as e:
            print(f"--- warmup skip: {e} ---", flush=True)
    print(f"engine[{backend.name}] on :{port}", flush=True)
    app.run(host="0.0.0.0", port=port, threaded=True)
