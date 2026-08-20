FROM python:3.12-slim
WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/src ./src
COPY database/seeds/synthetic ./database/seeds/synthetic
ENV BIM_SEED_PATH=/app/database/seeds/synthetic/platform.json
CMD ["uvicorn", "bim_api.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
