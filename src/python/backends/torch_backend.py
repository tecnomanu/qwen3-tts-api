"""PyTorch backend (universal): CUDA / ROCm / MPS / CPU.

Supports voice design, custom voice and CLONING (which MLX can't do today).
Slower on MPS (no flash-attn) but works everywhere.
"""
import os
import numpy as np
import torch
from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel
from backends.base import TTSBackend

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


def _device():
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class TorchBackend(TTSBackend):
    name = "torch"

    def __init__(self, models, models_dir):
        super().__init__(models, models_dir)
        self.device = _device()
        self._cache = {}
        print(f"[torch] device={self.device}", flush=True)

    def _model(self, role):
        src = self.resolve(role)
        if src not in self._cache:
            print(f"[torch] loading {src} ...", flush=True)
            self._cache[src] = Qwen3TTSModel.from_pretrained(
                src,
                device_map=self.device,
                dtype=torch.float16 if self.device in ("mps", "cuda") else torch.float32,
                attn_implementation="sdpa" if self.device == "mps" else None,
            )
        return self._cache[src]

    def loaded(self):
        return list(self._cache.keys())

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None):
        lang = (language or "spanish").lower()
        if clone:
            model = self._model("base")
            wavs, sr = model.generate_voice_clone(
                text, ref_audio=clone, language=lang, x_vector_only_mode=True
            )
        elif instruct:
            model = self._model("voicedesign")
            wavs, sr = model.generate_voice_design(text, instruct=instruct, language=lang)
        else:
            model = self._model("custom")
            wavs, sr = model.generate_custom_voice(text, speaker="aiden", language=lang)
        return np.asarray(wavs[0], dtype=np.float32), sr
