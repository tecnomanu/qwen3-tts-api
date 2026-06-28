"""Inference backend interface (common contract).

Each backend implements synth(). The rest of the engine (Flask app) does not know
whether MLX, PyTorch or CPU runs underneath -> dependency inversion.
"""
from __future__ import annotations
import os


class TTSBackend:
    name = "base"

    def __init__(self, models: dict, models_dir: str):
        self.models = models          # {"voicedesign": id|path, "base": ..., "custom": ...}
        self.models_dir = models_dir

    def resolve(self, role_or_id: str) -> str:
        """Resolve a role ('base') or id to a local path (if present) or the remote id."""
        ident = self.models.get(role_or_id, role_or_id)
        local = os.path.join(self.models_dir, ident.split("/")[-1])
        return local if os.path.isdir(local) else ident

    def loaded(self) -> list[str]:
        raise NotImplementedError

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None, seed=None):
        """Return (audio_float32_mono: np.ndarray, sample_rate: int)."""
        raise NotImplementedError
