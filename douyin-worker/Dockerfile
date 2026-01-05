# Dockerfile for Douyin Worker (Standalone)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Node.js (Required for JS token generation in TubiQ crawler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy logic
COPY crawlers/ ./crawlers/
COPY config.yaml .
COPY main.py .

# Create logs directory and ensure permissions (Fixes PermissionError)
RUN mkdir -p logs && chmod 777 logs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
