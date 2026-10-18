# 1) Build the React app
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Django API that also serves the built app
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /app/frontend/dist /app/frontend/dist
RUN mkdir -p staticfiles && useradd --create-home app && chown -R app /app
USER app

# One process keeps the in-memory weather/route cache shared; threads handle
# concurrent requests while they wait on the external APIs.
CMD ["sh", "-c", "gunicorn config.wsgi --workers 1 --threads 8 --timeout 120 --bind 0.0.0.0:${PORT:-8000}"]
