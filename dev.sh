#!/usr/bin/env bash
set -e

echo "🚀 Verificando servicios de fondo en Docker (backend, redis, whisper)..."
docker compose up -d

echo "🛑 Verificando que el contenedor turismo_frontend no interfiera..."
docker stop turismo_frontend 2>/dev/null || true

echo "✨ Iniciando Expo Web con Hot Reload en http://localhost:8082 ..."
export BROWSER=none
export ELECTRON_EXTRA_LAUNCH_ARGS="--no-sandbox"
export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-}"
cd app-turismo
pnpm web
