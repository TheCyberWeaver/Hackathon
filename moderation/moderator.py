"""Abusive-language detection with a local quantized CPU classifier."""

import json
import re
import unicodedata
from threading import Lock

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from model_files import model_files

def normalized_question(question: str) -> str:
    text = unicodedata.normalize("NFKC", question)
    text = "".join(c for c in text if unicodedata.category(c) != "Cf")
    # Canonicalize common deliberately separated profanity before classification.
    # This changes model input only; it is not a word-list rejection rule.
    for phrase in ("fuck you", "fuck", "shit", "asshole", "bitch", "arschloch"):
        letters = phrase.replace(" ", "")
        pattern = r"(?<!\w)" + r"[\W_]*".join(letters) + r"(?!\w)"
        text = re.sub(pattern, phrase, text, flags=re.IGNORECASE)
    return text


class Moderator:
    def __init__(self, cache_dir: str, threshold: float = 0.95):
        if not np.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError("MODERATION_THRESHOLD must be between 0 and 1")
        self.threshold = threshold
        root = model_files(cache_dir)
        config = json.loads((root / "config.json").read_text())
        if config.get("id2label") != {"0": "not-toxic", "1": "toxic"}:
            raise ValueError("Unexpected classifier labels")
        self.tokenizer = Tokenizer.from_file(str(root / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=512)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        self.model = ort.InferenceSession(str(root / "onnx/model_quantized.onnx"),
                                          sess_options=options,
                                          providers=["CPUExecutionProvider"])
        self.lock = Lock()
        # Complete loading and warm inference before health reports ready.
        self.decide("Can you explain that again?")

    def decide(self, question: str) -> str:
        with self.lock:
            encoded = self.tokenizer.encode(normalized_question(question))
            inputs = {
                "input_ids": np.array([encoded.ids], dtype=np.int64),
                "attention_mask": np.array([encoded.attention_mask], dtype=np.int64),
            }
            logits = np.asarray(self.model.run(None, inputs)[0], dtype=np.float64)
        if logits.shape != (1, 2) or not np.all(np.isfinite(logits)):
            raise ValueError("Invalid classifier output")
        # Stable softmax: the model is a two-label, single-label classifier.
        probabilities = np.exp(logits[0] - np.max(logits[0]))
        score = float(probabilities[1] / probabilities.sum())
        return "reject" if score >= self.threshold else "accept"
