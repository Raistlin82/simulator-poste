#!/bin/bash

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Proactive cleanup of ports
echo "Cleaning up ports 8000 and 5173..."
lsof -ti:8000,5173 | xargs kill -9 2>/dev/null || true

echo "Checking environment..."
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

echo "Installing/Updating Backend Dependencies..."
pip install -r backend/requirements.txt --quiet

echo "Starting Backend (FastAPI)..."
python3 backend/main.py &
BACKEND_PID=$!

echo "Starting Frontend (Vite)..."
cd frontend
npm run dev &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID
