# AskPool moderation

A separate FastAPI service checks questions for abusive language with a quantized
multilingual DistilBERT classifier, ONNX Runtime, and a local tokenizer. It uses
CPU only, one worker and one inference thread, and needs no database or API key.
The model weights are about 136 MB. Deployment limits the container to one CPU
and 768 MiB of memory; these limits are not measured resource guarantees.

## API

`POST /moderate` accepts only a nonblank question, up to 200 characters:

```json
{"question":"Why is that the case?"}
```

A successful check returns exactly one field:

```json
{"decision":"accept"}
```

The other possible decision is `reject`. No reason or score is returned.
Extra fields, including `courseTitle`, and invalid questions return HTTP 422.
Inference failures return 503. `GET /health` responds after loading and warmup.
There is no public production port; Java uses `http://moderation:8090` over the
private Compose network.

Spring Boot sends only the trimmed question before storing it. An explicit
rejection returns HTTP 422 with "Please avoid abusive language." and saves
nothing. The existing student UI displays that error. Timeouts, connection
failures, invalid responses, and service errors allow submissions. The backend
timeout defaults to 800 ms. Outside deployment the check is disabled unless
`MODERATION_URL` is configured.

## Policy

General, unclear, and off-topic questions are accepted. There is no relevance
check and no course context. Examples such as "Why is that the case?", cake
recipes, and pizza questions pass.

Reject only when the classifier's toxicity score reaches `MODERATION_THRESHOLD`
(default `0.95`). Higher thresholds allow more questions. This conservative
setting passed the included English/German smoke examples; it is not a guarantee
of accuracy. A classifier can misread quotations or miss subtle abuse. Existing
professor moderation/reporting remains available.

The model repository revision and file checksums are pinned. The image build
downloads and warms the model; the running image reads cached files only.
Common separators in obfuscated profanity and invisible formatting characters
are normalized before classification.

## Temporary test portal

Run from the project root:

```powershell
.\test-moderation.ps1
# Open http://127.0.0.1:8091.
# Stop using the page's "Stop portal" button, or:
.\test-moderation.ps1 -Stop
```

The page has one question field, sample questions, the exact decision, request
timing, and a short history stored only in the tab. It binds to localhost and
does not contact AskPool or its database. Closing the browser tab leaves the
service running; Stop portal closes the service.

`-SkipInstall` reuses installed dependencies. `-Foreground` runs in the terminal
and supports Ctrl+C. Use `-Port 8092` for a different port, including with
`-Stop`. Use `-Threshold 0.98` for a more permissive filter. Initial startup
downloads the model; later runs reuse the cache offline. The portal is excluded
from the production image and deployment bundle.

## Run and check locally

From this directory in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe check_model.py
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8090 --workers 1
```

Set `MODERATION_URL=http://127.0.0.1:8090` when starting Java to enable local
integration. `MODERATION_TIMEOUT_MS` controls its timeout. Use
`check_model.py --url http://127.0.0.1:8090` to check a running service.
`MODERATION_CACHE_PATH` overrides the default ignored `.model-cache` directory.
API/policy unit tests use mocks; the separate smoke check runs the real model
against general, off-topic, technical, critical, and abusive examples.

## Deploy

Use [deploy-moderation.ps1](../deploy-moderation.ps1) from the project root. It
deploys frontend, backend, and moderation together. See
[deployment instructions](../deploy/README.md#moderation-service).
Release image tags support rollback. Initial builds require package/model access.

Model sources: [ONNX repository](https://huggingface.co/onnx-community/distilbert-multilingual-toxicity-classifier-ONNX)
and [original model card](https://huggingface.co/gravitee-io/distilbert-multilingual-toxicity-classifier).
