FROM python:3.11-slim

# Install system dependencies (FFmpeg required for thumbnail generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY main.py .

# Environment variables defaults
ENV VIDEO_DIR=/media/videos
ENV CACHE_DIR=/app/cache

EXPOSE 8000

# Run FastAPI server via Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
