FROM python:3.9-slim

WORKDIR /app

# Install system dependencies including ping tools for the monitor
RUN apt-get update && apt-get install -y \
    iputils-ping \
    traceroute \
    dnsutils \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
