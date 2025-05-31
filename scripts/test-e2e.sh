#!/bin/bash

# Helper script to run e2e tests locally with proper service coordination

set -e

echo "🚀 Starting PlayaPlan E2E Test Setup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're using Docker Compose or manual setup
USE_DOCKER=${USE_DOCKER:-false}

if [ "$USE_DOCKER" = "true" ]; then
    print_status "Using Docker Compose for e2e testing"
    
    # Setup environment
    if [ ! -f .env ]; then
        cp .env.sample .env
        echo "DATABASE_URL=postgresql://postgres:postgres@postgres:5432/playaplan_test" >> .env
        echo "JWT_SECRET=test-secret-key-for-ci" >> .env
        echo "NODE_ENV=development" >> .env
    fi
    
    # Start services
    print_status "Starting services with Docker Compose..."
    docker compose -f docker-compose.e2e.yml up -d --build
    
    # Wait for services
    print_status "Waiting for services to be ready..."
    timeout 120 bash -c 'until [ $(docker compose -f docker-compose.e2e.yml ps --services --filter health=healthy | wc -l) -eq 3 ]; do
        echo "Waiting for services..."
        sleep 2
    done'
    
    # Setup database
    print_status "Setting up database..."
    docker compose -f docker-compose.e2e.yml exec api npx prisma migrate deploy
    docker compose -f docker-compose.e2e.yml exec api npx prisma db seed
    
    # Run tests
    print_status "Running Playwright tests..."
    npx playwright test "$@"
    
    # Cleanup
    print_status "Cleaning up..."
    docker compose -f docker-compose.e2e.yml down -v
    
else
    print_status "Using manual service startup for e2e testing"
    
    # Check prerequisites
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client not found. Please install postgresql-client."
        exit 1
    fi
    
    # Setup environment
    if [ ! -f .env.test ]; then
        print_warning "Creating .env.test file"
        cat > .env.test << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test
JWT_SECRET=test-secret-key-for-ci
JWT_EXPIRATION_TIME=24h
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000
EOF
    fi
    
    # Start PostgreSQL if not running
    if ! pg_isready -h localhost -p 5432 -U postgres &> /dev/null; then
        print_warning "PostgreSQL not running. Starting with Docker..."
        docker run --name postgres-e2e -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=playaplan_test -p 5432:5432 -d postgres:15
        sleep 5
    fi
    
    # Setup database
    print_status "Setting up database..."
    cd apps/api
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test npx prisma generate
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test npx prisma migrate deploy
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test npx prisma db seed
    cd ../..
    
    # Start API server
    print_status "Starting API server..."
    cd apps/api
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test \
    JWT_SECRET=test-secret-key-for-ci \
    NODE_ENV=development \
    PORT=3000 \
    nohup npm run dev > ../../api.log 2>&1 &
    API_PID=$!
    echo $API_PID > ../../api.pid
    cd ../..
    
    # Wait for API
    print_status "Waiting for API server..."
    timeout 60 bash -c 'until curl -f http://localhost:3000/health &>/dev/null; do sleep 2; done'
    
    # Start Web server
    print_status "Starting Web server..."
    cd apps/web
    VITE_API_URL=http://localhost:3000 \
    NODE_ENV=development \
    nohup npm run dev > ../../web.log 2>&1 &
    WEB_PID=$!
    echo $WEB_PID > ../../web.pid
    cd ../..
    
    # Wait for Web server
    print_status "Waiting for Web server..."
    timeout 60 bash -c 'until curl -f http://localhost:5173 &>/dev/null; do sleep 2; done'
    
    # Run tests
    print_status "Running Playwright tests..."
    npx playwright test "$@"
    
    # Cleanup
    print_status "Cleaning up..."
    if [ -f api.pid ]; then
        kill $(cat api.pid) 2>/dev/null || true
        rm api.pid
    fi
    if [ -f web.pid ]; then
        kill $(cat web.pid) 2>/dev/null || true
        rm web.pid
    fi
    
    # Stop PostgreSQL container if we started it
    docker stop postgres-e2e 2>/dev/null || true
    docker rm postgres-e2e 2>/dev/null || true
fi

print_status "E2E test run completed!"