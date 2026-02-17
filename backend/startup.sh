#!/bin/sh

echo "================================================"
echo "Starting Backend Application"
echo "================================================"
echo "Working directory: $(pwd)"
echo "User: $(whoami)"
echo "Python version: $(python --version)"
echo ""

# Run database migrations (non-blocking - app will create DB on first run if needed)
echo "Attempting database migrations..."
if python run_migrations.py; then
    echo "Migrations completed successfully"
else
    echo "WARNING: Migration script failed or DB not ready"
    echo "The application will create the database on first startup if needed"
    echo "This is normal for first deployment"
fi

echo ""
echo "Starting Gunicorn server..."
echo "================================================"

# Start the application with gunicorn
# Use single worker to avoid race conditions with SQLite and lifespan seeding
exec gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile -
