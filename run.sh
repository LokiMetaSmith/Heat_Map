#!/bin/bash

# Exit on any error
set -e

# Help function
show_help() {
    echo "Usage: ./run.sh [container|baremetal] [node|php]"
    echo ""
    echo "Modes:"
    echo "  container    Run the full application inside Docker containers."
    echo "  baremetal    Run the database in Docker, but run the backend application directly on the host machine."
    echo ""
    echo "Backends:"
    echo "  node         (Default) Run the Node.js backend."
    echo "  php          Run the PHP backend."
    echo ""
}

# Check argument
MODE=$1
BACKEND=${2:-node}

if [[ -z "$MODE" ]]; then
    echo "Error: Missing argument."
    show_help
    exit 1
fi

if [[ "$BACKEND" != "node" && "$BACKEND" != "php" ]]; then
    echo "Error: Invalid backend '$BACKEND'."
    show_help
    exit 1
fi

get_compose_cmd() {
    if command -v podman-compose &> /dev/null; then
        echo "podman-compose"
    elif command -v podman &> /dev/null && podman compose version &> /dev/null; then
        echo "podman compose"
    elif command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker compose"
    fi
}

COMPOSE_CMD=$(get_compose_cmd)

# Always tear down any existing containers to avoid port conflicts
echo "Tearing down existing containers..."
$COMPOSE_CMD down

case "$MODE" in
    container)
        echo "Starting application in Container mode with $BACKEND backend..."
        if [[ "$BACKEND" == "node" ]]; then
            $COMPOSE_CMD up --build db app-node
        else
            $COMPOSE_CMD up --build db app-php
        fi
        ;;

    baremetal)
        echo "Starting database in Docker..."
        $COMPOSE_CMD up -d db

        echo "Waiting for database to be ready..."
        sleep 5

        if [[ "$BACKEND" == "node" ]]; then
            echo "Installing Node.js dependencies..."
            npm install
            echo "Starting Node.js application locally..."
            POSTGRES_HOST=localhost npm start
        else
            echo "Installing PHP dependencies..."
            cd php
            composer install
            echo "Starting PHP application locally..."
            # Setup a temporary router script for PHP's built-in server to handle routing like Apache mod_rewrite
            cat << 'EOF' > router.php
<?php
// Emulate mod_rewrite for PHP built-in server
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve api requests to index.php
if (preg_match('#^/api/#', $path)) {
    require __DIR__ . '/index.php';
    return true;
}

// Serve public files directly
$publicPath = __DIR__ . '/../public' . $path;
if (is_file($publicPath)) {
    return false; // let the server handle serving the static file
}

// Default to index.html
if ($path === '/' || !is_file($publicPath)) {
    readfile(__DIR__ . '/../public/index.html');
    return true;
}
return false;
EOF
            POSTGRES_HOST=localhost php -S localhost:3000 -t ../public router.php
        fi
        ;;

    *)
        echo "Error: Invalid mode '$MODE'."
        show_help
        exit 1
        ;;
esac