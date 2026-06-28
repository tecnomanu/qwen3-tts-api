# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "transformers>=5.0.0rc1",
#     "mlx-audio==0.3.0rc1",
#     "flask",
#     "numpy",
#     "soundfile",
# ]
# ///
"""Entry-point del motor con backend MLX (Apple Silicon)."""
import os
import sys
import warnings

warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backends.mlx_backend import MlxBackend  # noqa: E402
from _app import run  # noqa: E402

models = {
    "voicedesign": os.environ.get("QVOX_MODEL_VOICEDESIGN", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
    "base": os.environ.get("QVOX_MODEL_BASE", "Qwen/Qwen3-TTS-12Hz-1.7B-Base"),
    "custom": os.environ.get("QVOX_MODEL_CUSTOM", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"),
}
run(MlxBackend(models, os.environ.get("QVOX_MODELS_DIR", ".")))
