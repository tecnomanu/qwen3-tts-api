"""Backend MLX (Apple Silicon). Rápido para VoiceDesign/CustomVoice.

OJO: la clonación está rota en mlx-audio 0.3.0rc1 (speaker_encoder con layout
channels-first vs conv channels-last). Para clonar usar el backend torch.
"""
import numpy as np
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
            print(f"[mlx] cargando {src} ...", flush=True)
            self._cache[src] = load_model(src)
        return self._cache[src]

    def loaded(self):
        return list(self._cache.keys())

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None):
        if clone:
            raise RuntimeError(
                "Clonación no soportada en backend MLX (bug en mlx-audio 0.3.0rc1). "
                "Cambiá a backend torch: qvox config set engine.backend torch"
            )
        mt = max_tokens or cap_tokens(text)
        model = self._model("voicedesign")
        results = list(model.generate_voice_design(
            text=text, language=language, instruct=instruct or "A natural, clear voice.",
            temperature=temperature, max_tokens=mt, verbose=False))
        return np.array(results[0].audio, dtype=np.float32), model.sample_rate
