#!/usr/bin/env bash
# Runs ON the EC2 host after git pull (invoked by GitHub Actions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking backend/.env"
if [ ! -f backend/.env ]; then
  echo "backend/.env is missing."
  echo "On the server: cp backend/.env.example backend/.env && edit secrets, then re-run deploy."
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> Creating root .env from example values (edit later if needed)"
  cat > .env <<'EOF'
POSTGRES_USER=tracksphere
POSTGRES_PASSWORD=tracksphere_dev
POSTGRES_DB=tracksphere
DATABASE_URL=postgresql://tracksphere:tracksphere_dev@db:5432/tracksphere
VITE_API_URL=http://127.0.0.1:4000
EOF
fi

echo "==> Building and starting production stack"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Applying SQL migrations (safe / idempotent)"
# Wait for DB
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U tracksphere -d tracksphere >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cat database/migrate_3_5.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U tracksphere -d tracksphere || true
cat database/migrate_4_0.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U tracksphere -d tracksphere || true

echo "==> Container status"
docker compose -f docker-compose.prod.yml ps

echo "==> Health check (local API)"
sleep 3
curl -fsS http://127.0.0.1:4000/api/health || {
  echo "WARNING: API health check failed — inspect: docker logs tracksphere-api"
  exit 1
}

echo "Remote deploy OK"
