#!/bin/bash
# Start Backend Server - Simulator Poste
# FastAPI backend with auto-reload for development

set -e  # Exit on error

echo "🚀 Starting Backend Server..."
echo ""

# Check if we're in the correct directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: backend/main.py not found"
    echo "   Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d "../venv" ]; then
    echo "⚠️  No virtual environment found. Creating one..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment if it exists locally
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Set environment variables for development
export ENVIRONMENT=development
export LOG_LEVEL=INFO
# Local development only: run without OIDC. Authentication is fail-closed, so
# this explicit opt-in is required to use the app without configuring OIDC.
# NEVER set this in staging/production.
export AUTH_DEV_BYPASS=1

echo ""
echo "🎯 Backend server starting on http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo "💚 Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the server with auto-reload
# Bind to loopback only: this script runs with AUTH_DEV_BYPASS=1 (no auth), so
# the server must NOT be reachable from other devices on the network.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
