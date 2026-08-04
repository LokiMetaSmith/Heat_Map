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
        # Check for podman or docker compose
        if command -v podman-compose &> /dev/null; then
            podman-compose up --build
        elif command -v podman &> /dev/null && podman compose version &> /dev/null; then
            podman compose up --build
        elif command -v docker-compose &> /dev/null; then
            docker-compose up --build
        elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
            docker compose up --build
        else
            # fallback to docker compose and let it error out if missing
            docker compose up --build
        fi
        ;;

    baremetal)
        echo "Starting database in Docker..."
        if command -v podman-compose &> /dev/null; then
            podman-compose up -d db
        elif command -v podman &> /dev/null && podman compose version &> /dev/null; then
            podman compose up -d db
        elif command -v docker-compose &> /dev/null; then
            docker-compose up -d db
        elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
            docker compose up -d db
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