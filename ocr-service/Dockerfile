FROM python:3.11-slim

WORKDIR /app

# System-Dependencies: OpenCV (libgl1, libglib2.0-0), PaddlePaddle OpenMP (libgomp1), health check (curl)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# PaddleOCR-Modelle vorab herunterladen, damit der Container sofort bereit ist.
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='german', use_gpu=False, show_log=False)"

EXPOSE 8868

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8868"]
