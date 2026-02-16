#!/bin/sh
set -e

echo "================================================"
echo "Starting Backend Application"
echo "================================================"

# Run database migrations
echo "Running database migrations..."
python run_migrations.py

if [ $? -ne 0 ]; then
    echo "Migration failed, exiting..."
    exit 1
fi

echo "Migrations completed successfully"
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
