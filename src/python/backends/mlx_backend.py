"""MLX backend (Apple Silicon). Fast for VoiceDesign/CustomVoice.

NOTE: cloning is broken in mlx-audio 0.3.0rc1 (speaker_encoder uses channels-first
layout vs channels-last convs). Use the torch backend to clone.
"""
import numpy as np
import mlx.core as mx
from mlx_audio.tts.utils import load_model
from backends.base import TTSBackend


def cap_tokens(text):
    return min(2048, max(160, int(len(text) * 1.8) + 48))


class MlxBackend(TTSBackend):
    name = "mlx"

    def __init__(self, models, models_dir):
        super().__init__(models, models_dir)
        self._cache = {}

    def _model(self, role):
        src = self.resolve(role)
        if src not in self._cache:
            print(f"[mlx] loading {src} ...", flush=True)
            self._cache[src] = load_model(src)
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
                text=text, language=language, instruct=instruct or "A natural, clear voice.",
                temperature=temperature, max_tokens=mt, verbose=False))
        return np.array(results[0].audio, dtype=np.float32), model.sample_rate
