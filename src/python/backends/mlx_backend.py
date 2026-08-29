"""MLX backend (Apple Silicon). Fast for VoiceDesign/CustomVoice.

NOTE: cloning is broken in mlx-audio 0.3.0rc1 (speaker_encoder uses channels-first
layout vs channels-last convs). Use the torch backend to clone.
"""
import time
import numpy as np
import mlx.core as mx
from mlx_audio.tts.utils import load_model
from backends.base import TTSBackend


def cap_tokens(text):
    """Token ceiling for one chunk. The model is 12 Hz, so tokens/12 = seconds.

    This is the only hard stop on a runaway. When the model fails to emit EOS
    it generates until it hits this number, so the ceiling *is* the damage: a
    28-char line that should take 24 tokens was allowed 160 and came back as
    13 seconds of noise. Every runaway measured landed on exactly ~156 tokens,
    which is the old floor, not a coincidence.

    Observed cost of real speech is 0.85-1.3 tokens per character, so 1.35x
    plus a small constant clears the worst legitimate case with room to spare —
    verified against known-good lines at 28 and 63 chars, which came back
    identical with the ceiling applied.

    The floor matters as much as the slope, because for short text the floor IS
    the ceiling. Short exclamations are the reliable trigger: "¡Hola Manu!"
    never emits EOS and runs to whatever it is given — 32 tokens produced 2.7s
    of humming for eleven characters, while "Hola Manu." stopped on its own at
    12. The floor only has to cover text too short for the slope to reach a
    sayable length, so 20 tokens (1.7s, about 20 characters of speech) is
    enough, and it caps that same greeting at 1.7s instead of 2.7s.
    """
    return min(2048, max(20, int(len(text) * 1.35) + 12))


class MlxBackend(TTSBackend):
    name = "mlx"

    def __init__(self, models, models_dir):
        super().__init__(models, models_dir)
        self._cache = {}

    def _model(self, role):
        src = self.resolve(role)
        if src not in self._cache:
            print(f"[mlx] loading {src} ...", flush=True)
            t = time.time()
            self._cache[src] = load_model(src)
            self._track_load(src, (time.time() - t) * 1000)
        return self._cache[src]

    def loaded(self):
        return list(self._cache.keys())

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None, seed=None, voice=None):
        if clone:
            raise RuntimeError(
                "Cloning is not supported on the MLX backend (bug in mlx-audio 0.3.0rc1). "
                "Switch to the torch backend: qvox config set engine.backend torch"
            )
        if seed is not None:
            mx.random.seed(int(seed))  # fixed seed -> stable voice across segments
        mt = max_tokens or cap_tokens(text)
        if voice:  # named CustomVoice speaker
            model = self._model("custom")
            results = list(model.generate_custom_voice(
                text=text, speaker=voice, instruct=instruct or "", language=language,
                temperature=temperature, max_tokens=mt, verbose=False))
        else:
            model = self._model("voicedesign")
            results = list(model.generate_voice_design(
                text=text, language=language, # Measured at 2.2 chars/s — the fallback voice was the slowest thing
                # in the system. "A neutral male voice, clear and even" holds 9.3.
                instruct=instruct or "A neutral male voice, clear and even",
                temperature=temperature, max_tokens=mt, verbose=False))
        return np.array(results[0].audio, dtype=np.float32), model.sample_rate
