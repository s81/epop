#!/bin/sh
set -e

echo "Running migrations..."
tsx /app/scripts/migrate.ts

echo "Starting app..."
exec "$@"
