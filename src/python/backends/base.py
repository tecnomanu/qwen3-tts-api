"""Inference backend interface (common contract).

Each backend implements synth(). The rest of the engine (Flask app) does not know
whether MLX, PyTorch or CPU runs underneath -> dependency inversion.
"""
from __future__ import annotations
import os
import json


class TTSBackend:
    name = "base"

    def __init__(self, models: dict, models_dir: str):
        self.models = models          # {"voicedesign": id|path, "base": ..., "custom": ...}
        self.models_dir = models_dir
        self._load_events = []        # load timings since last drain (for the panel log)

    def _track_load(self, src: str, ms: float):
        """Record that a checkpoint was loaded into memory (ms it took)."""
        self._load_events.append({"src": src.split("/")[-1], "ms": round(ms)})

    def drain_load_events(self) -> list[dict]:
        """Return the load events recorded since the last call, and reset."""
        ev = self._load_events
        self._load_events = []
        return ev

    def resolve(self, role_or_id: str) -> str:
        """Resolve a role ('base') or id to a local path (if present) or the remote id."""
        ident = self.models.get(role_or_id, role_or_id)
        local = os.path.join(self.models_dir, ident.split("/")[-1])
        return local if os.path.isdir(local) else ident

    def speakers(self) -> list[str]:
        """Named voices from the CustomVoice model config (spk_id), if downloaded.
        Returns [] when the CustomVoice model is not present locally."""
        src = self.resolve("custom")
        cfg = os.path.join(src, "config.json")
        if os.path.isfile(cfg):
            try:
                d = json.load(open(cfg, encoding="utf-8"))
                spk = (d.get("talker_config") or {}).get("spk_id") or {}
                return list(spk.keys())
            except Exception:
                return []
        return []

    def loaded(self) -> list[str]:
        raise NotImplementedError

    def synth(self, text, language="Spanish", instruct=None, clone=None,
              temperature=0.7, max_tokens=None, seed=None, voice=None):
        """Return (audio_float32_mono: np.ndarray, sample_rate: int)."""
        raise NotImplementedError
