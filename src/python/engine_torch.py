# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "qwen-tts",
#     "torch",
#     "transformers",
#     "flask",
#     "soundfile",
#     "librosa>=0.10",
#     "numba>=0.60",
#     "numpy",
#     "accelerate",
# ]
# ///
"""Entry-point del motor con backend PyTorch (universal: CUDA/ROCm/MPS/CPU)."""
import os
import sys
import warnings

warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backends.torch_backend import TorchBackend  # noqa: E402
from _app import run  # noqa: E402

models = {
    "voicedesign": os.environ.get("QVOX_MODEL_VOICEDESIGN", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
    "base": os.environ.get("QVOX_MODEL_BASE", "Qwen/Qwen3-TTS-12Hz-1.7B-Base"),
    "custom": os.environ.get("QVOX_MODEL_CUSTOM", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"),
}
run(TorchBackend(models, os.environ.get("QVOX_MODELS_DIR", ".")))
