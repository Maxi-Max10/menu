FROM colmap/colmap:latest

ENV DEBIAN_FRONTEND=noninteractive QT_QPA_PLATFORM=offscreen
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN python3 -m venv /opt/polo-venv && /opt/polo-venv/bin/pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["/opt/polo-venv/bin/uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
