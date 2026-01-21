#!/bin/bash

# Script di avvio produzione: backend FastAPI + frontend statico
# Richiede: virtualenv attivo, build già fatta (frontend/dist)

trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Cleanup porte
lsof -ti:8000,3000 | xargs kill -9 2>/dev/null || true

# Attiva virtualenv se presente
if [ -d ".venv" ]; then
    echo "Attivo virtualenv..."
    source .venv/bin/activate
fi

# Installa dipendenze backend
pip install -r backend/requirements.txt --quiet

# Avvia backend FastAPI (porta 8000)
echo "Avvio backend (FastAPI, porta 8000)..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Avvia server statico per frontend (porta 3000)
echo "Avvio server statico per frontend (porta 3000)..."
cd frontend
npx serve dist -l 3000 &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID
