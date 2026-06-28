"""Interfaz de backend de inferencia (contrato común).

Cada backend implementa synth(). El resto del motor (app Flask) no sabe si por
debajo corre MLX, PyTorch o CPU -> inversión de dependencias.
"""
from __future__ import annotations
import os


class TTSBackend:
    name = "base"

    def __init__(self, models: dict, models_dir: str):
        self.models = models          # {"voicedesign": id|path, "base": ..., "custom": ...}
        self.models_dir = models_dir

    def resolve(self, role_or_id: str) -> str:
        """Resuelve un rol ('base') o id a un path local (si existe) o al id remoto."""
        ident = self.models.get(role_or_id, role_or_id)
        local = os.path.join(self.models_dir, ident.split("/")[-1])
        return local if os.path.isdir(local) else ident

    def loaded(self) -> list[str]:
        raise NotImplementedError

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None):
        """Devuelve (audio_float32_mono: np.ndarray, sample_rate: int)."""
        raise NotImplementedError
