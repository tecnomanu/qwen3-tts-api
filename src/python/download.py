# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "huggingface_hub",
#     "hf_transfer",
# ]
# ///
"""Download a HuggingFace model into a local folder, with a progress bar.
Usage: uv run download.py <repo_id> <dest_dir>
Uses HF_TOKEN if present in the environment (avoids anonymous throttling).
"""
import os
import sys
import json
import time
import threading
import urllib.request

# disable hf's internal bars so we show a single, global one
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
from huggingface_hub import snapshot_download  # noqa: E402

repo, dest = sys.argv[1], sys.argv[2]
token = os.environ.get("HF_TOKEN")


def total_size(repo_id):
    try:
        url = f"https://huggingface.co/api/models/{repo_id}/tree/main?recursive=1"
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        req = urllib.request.Request(url, headers=headers)
        data = json.load(urllib.request.urlopen(req, timeout=20))
        return sum(((f.get("lfs") or {}).get("size") or f.get("size", 0))
                   for f in data if f.get("type") == "file")
    except Exception:
        return 0


def dir_size(path):
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


total = total_size(repo)
stop = threading.Event()


def render_bar():
    width = 42
    while not stop.is_set():
        cur = dir_size(dest)
        if total:
            pct = min(100, int(cur * 100 / total))
            n = int(width * pct / 100)
            sys.stdout.write(
                f"\r  [{'█' * n}{'·' * (width - n)}] {pct:3d}%  "
                f"{cur / 1048576:6.0f} / {total / 1048576:.0f} MB"
            )
        else:
            sys.stdout.write(f"\r  downloaded {cur / 1048576:.0f} MB ...")
        sys.stdout.flush()
        time.sleep(0.5)


print(f"Downloading {repo}\n   -> {dest}", flush=True)
worker = threading.Thread(target=render_bar, daemon=True)
worker.start()
try:
    snapshot_download(repo_id=repo, local_dir=dest, token=token)
finally:
    stop.set()
    worker.join(timeout=1)
print(f"\n  complete: {dest}", flush=True)
