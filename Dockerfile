FROM python:3.12-slim

LABEL maintainer="Vibro Project"
LABEL description="Vibro — AI gearbox diagnostics training & serving"

WORKDIR /app

# Install dependencies first (cached unless requirements.txt changes)
COPY requirements.txt .
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

# Copy config and setup (changes less often)
COPY pyproject.toml .

# Copy source code (separate layers for better caching)
COPY python/ python/
COPY tests/ tests/
COPY web/ web/

# Create data directory
RUN mkdir -p python/data python/models runtime

# Default: run FastAPI app on port 8000
EXPOSE 8000

# ═══ Usage ═══
# Build:
#   docker build -t vibro .
#
# Train (mount your data):
#   docker run -v /path/to/gearset:/app/python/data vibro \
#     sh -c "cd python && python train.py data/ && python export_model.py"
#
# Serve platform:
#   docker run -p 8000:8000 vibro
#
# Run tests:
#   docker run vibro python -m pytest tests/ -v

CMD ["uvicorn", "backend.main:app", "--app-dir", "python", "--host", "0.0.0.0", "--port", "8000"]
