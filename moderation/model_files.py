"""Fetch a fixed model revision once, then run entirely from the local cache."""

import hashlib
import os
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MODEL_REPO = "onnx-community/distilbert-multilingual-toxicity-classifier-ONNX"
MODEL_REVISION = "4fbaccee8caaba02641b1757f7ef697e3fbffdb8"
FILES = {
    "config.json": (829, "b3b5b837f833d5b71cd9a89e54921c4e79ee93baf9ae971372faecfce151c80c"),
    "tokenizer.json": (2919627, "c2c0e4d392f08c2c2eb950156eb26e4e5ddd15b557faa45ed6a0decaf45b5f98"),
    "onnx/model_quantized.onnx": (
        135908348, "52e703cb3d8a3aac8c5d35a350dbc20fd5f0a54b00f01b4b88fc5bb2052f7700"),
}


def valid_file(path, size, digest):
    if not path.is_file() or path.stat().st_size != size:
        return False
    if digest:
        with path.open("rb") as source:
            return hashlib.file_digest(source, "sha256").hexdigest() == digest
    return True


def model_files(cache_dir):
    root = Path(cache_dir) / "abuse-model" / MODEL_REVISION
    with requests.Session() as session:
        session.mount("https://", HTTPAdapter(max_retries=Retry(
            total=4, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"])))
        for name, (size, digest) in FILES.items():
            target = root / name
            if valid_file(target, size, digest):
                continue
            if os.getenv("HF_HUB_OFFLINE", "0") == "1":
                raise RuntimeError(f"Missing or invalid cached model file: {name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(".part")
            try:
                url = f"https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/{name}"
                with session.get(url, stream=True, timeout=(20, 60)) as response:
                    response.raise_for_status()
                    with temporary.open("wb") as out:
                        for chunk in response.iter_content(1024 * 1024):
                            out.write(chunk)
                if not valid_file(temporary, size, digest):
                    raise RuntimeError(f"Model file integrity check failed: {name}")
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
    return root
