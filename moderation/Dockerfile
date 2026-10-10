FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MODERATION_CACHE_PATH=/app/model-cache
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY moderator.py model_files.py ./
# Bake the quantized model into the image; runtime requires no downloads.
RUN python -c "from moderator import Moderator; Moderator('/app/model-cache')"
ENV HF_HUB_OFFLINE=1
COPY app.py check_model.py check_backend.py ./
# Extracted deployment files can have owner-only source permissions.
# Make runtime access explicit before switching to the application user.
RUN useradd --uid 10001 --no-create-home app \
    && chmod 0755 /app \
    && chmod 0644 /app/*.py /app/requirements.txt \
    && chmod -R a+rX /app/model-cache
USER 10001
# Fail the image build if this user cannot import the API or read the model.
RUN python -c "from app import app; from moderator import Moderator; Moderator('/app/model-cache')"
EXPOSE 8090
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=6 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1", "--limit-concurrency", "32", "--no-access-log"]
