# ─────────────────────────────────────────────────────────────────────────────
# CaféSmart ML microservice — standalone image for docker-compose.yml
# ─────────────────────────────────────────────────────────────────────────────
# glibc-based slim (NOT Alpine): scikit-learn / pandas / numpy ship
# manylinux wheels, so pip installs binaries with no compiler toolchain.
# The root Dockerfile keeps its own co-hostedML path for single-container
# deploys; this image is for the split `ml` compose service.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ML_SERVICE_PORT=8000

WORKDIR /srv

RUN adduser --system --uid 1001 --group mluser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py forecaster.py ./
COPY services ./services
COPY models ./models
RUN chown -R mluser:mluser /srv

USER mluser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${ML_SERVICE_PORT:-8000}"]
