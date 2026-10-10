"""Exercise Java enforcement using only the disposable candidate database."""

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone


def call(method, path, payload, expected):
    request = urllib.request.Request(
        "http://backend:8080/api" + path,
        method=method,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-User-Id": "candidate-moderation-check"},
    )
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = json.load(response)
        if response.status != expected:
            raise RuntimeError(f"{method} {path}: expected HTTP {expected}, got {response.status}")
        return body


lecture = call("POST", "/lectures", {
    "title": "Moderation candidate check", "course": "Algorithms",
    "lectureTime": datetime.now(timezone.utc).isoformat(),
}, 201)["id"]
call("PATCH", f"/lectures/{lecture}/session", {"action": "start"}, 200)
path = f"/lectures/{lecture}/questions"
call("POST", path, {"text": "Why is merge sort O(n log n)?"}, 201)
call("POST", path, {"text": "How do I bake a chocolate cake?"}, 201)
call("POST", path, {"text": "You are a fucking idiot."}, 422)
if len(call("GET", path, None, 200)) != 2:
    raise RuntimeError("Java persisted a rejected question")
print("Candidate Java moderation enforcement passed", flush=True)
