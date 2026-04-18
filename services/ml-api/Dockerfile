FROM python:3.12-slim-bookworm

WORKDIR /app

# OpenMP for numpy/sklearn; NVIDIA driver is injected at runtime (see docker-compose).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install deps (CPU torch from PyPI is fine), then replace torch with CUDA 12.4 wheels for the GPU image.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --force-reinstall "torch>=2.2.0" --index-url https://download.pytorch.org/whl/cu124

COPY app ./app

ENV PYTHONPATH=/app
# Default: use CUDA when the runtime exposes it (overridden per-request or set to `cpu` to force CPU).
ENV KRONOS_DEVICE=cuda

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
