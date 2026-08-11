FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PIP_RETRIES=10

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libxcb1 && \
    rm -rf /var/lib/apt/lists/*

RUN python -m venv /app/.venv

ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

RUN pip install --upgrade pip

RUN pip install \
        --index-url https://download.pytorch.org/whl/cpu \
        torch torchvision

COPY requirements.txt .

RUN pip install \
        --timeout 1000 \
        --retries 10 \
        -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "-u", "main.py"]