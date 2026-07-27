#!/bin/bash

# Exit on any error
set -e

# Help function
show_help() {
    echo "Usage: ./run.sh [container|baremetal]"
    echo ""
    echo "Options:"
    echo "  container    Run the full application (Node backend + Postgres db) inside Docker containers."
    echo "  baremetal    Run the database in Docker, but run the Node.js application directly on the host machine."
    echo ""
}

# Check argument
MODE=$1

if [[ -z "$MODE" ]]; then
    echo "Error: Missing argument."
    show_help
    exit 1
fi

case "$MODE" in
    container)
        echo "Starting application in Container mode..."
        # We use docker compose (v2) or docker-compose (v1)
        if command -v docker-compose &> /dev/null; then
            docker-compose up --build
        else
            docker compose up --build
        fi
        ;;

    baremetal)
        echo "Starting database in Docker..."
        if command -v docker-compose &> /dev/null; then
            docker-compose up -d db
        else
            docker compose up -d db
        fi

        echo "Waiting for database to be ready..."
        # Small sleep to ensure DB starts accepting connections. Healthcheck in compose will handle it mostly, but wait loop is safer for local run.
        sleep 5

        echo "Installing Node.js dependencies..."
        npm install

        echo "Starting Node.js application locally..."
        # Pass localhost for the DB connection
        POSTGRES_HOST=localhost npm start
        ;;

    *)
        echo "Error: Invalid argument '$MODE'."
        show_help
        exit 1
        ;;
esac