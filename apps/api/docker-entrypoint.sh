#!/bin/sh

echo "Starting database initialization..."

# Check DATABASE_URL configuration (without exposing sensitive info)
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?\"]*\).*/\1/p')
  echo "DATABASE_URL configured - connecting to host: $DB_HOST, database: $DB_NAME"
  
  # Validate URL format
  if echo "$DATABASE_URL" | grep -q "^postgresql://\|^postgres://"; then
    echo "✓ DATABASE_URL format appears valid"
  else
    echo "✗ ERROR: DATABASE_URL does not start with postgresql:// or postgres://"
    echo "Current DATABASE_URL format: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/g')"
    exit 1
  fi
else
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please provide a valid PostgreSQL connection string."
  echo "Example: DATABASE_URL=\"postgresql://user:password@host:5432/database\""
  exit 1
fi

# Debug: Show environment variables (without passwords)
echo "Environment check:"
echo "  NODE_ENV: ${NODE_ENV:-not set}"
echo "  DATABASE_URL format: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/g')"

# Ensure we're in the correct directory for Prisma
echo "Current working directory: $(pwd)"
echo "Looking for Prisma schema..."
if [ -f "prisma/schema.prisma" ]; then
  echo "✓ Found prisma/schema.prisma"
else
  echo "✗ prisma/schema.prisma not found, listing directory contents:"
  ls -la
  if [ -f "../prisma/schema.prisma" ]; then
    echo "Found schema in parent directory, changing to parent"
    cd ..
  else
    echo "ERROR: Cannot find prisma/schema.prisma"
    exit 1
  fi
fi

# Extract port for connectivity testing
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:]*:\([^\/]*\)\/.*/\1/p')

# Initialize database schema and connection
echo "Initializing database connection and schema..."
RETRY_COUNT=0
MAX_RETRIES=30
until npx prisma db push --accept-data-loss 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Database not ready (attempt $RETRY_COUNT/$MAX_RETRIES), waiting 2 seconds..."
  
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Failed to connect to database after $MAX_RETRIES attempts"
    echo "Connection details:"
    echo "  Host: $DB_HOST"
    echo "  Database: $DB_NAME"
    echo ""
    echo "Please verify:"
    echo "  - Database server is running and accessible"
    echo "  - Database '$DB_NAME' exists"
    echo "  - Credentials are correct"
    echo "  - Network connectivity (firewall, SSL settings)"
    echo "  - DATABASE_URL format: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/g')"
    echo ""
    echo "Last Prisma error:"
    npx prisma db push --accept-data-loss 2>&1
    exit 1
  fi
  
  sleep 2
done

echo "✓ Database connection established and schema synchronized!"

# Seed the database if needed (idempotent by default)
echo "Checking if database needs seeding..."
if [ "${FORCE_RESEED:-false}" = "true" ]; then
  echo "FORCE_RESEED=true detected, will perform forced re-seeding"
  if npm run seed:dev:force; then
    echo "Force database re-seeding completed!"
  else
    echo "WARNING: Force database re-seeding failed!"
    echo "Continuing with startup..."
  fi
else
  echo "Running idempotent seed (will only seed if database is empty)..."
  if npm run seed:dev; then
    echo "Database seeding completed!"
  else
    echo "Database seeding failed or was skipped (data may already exist)."
    echo "Continuing with startup..."
  fi
fi

echo "Database initialization complete!"

# For production mode, ensure the application is built
if [ "${NODE_ENV}" = "production" ]; then
  echo "Production mode detected, ensuring application is built..."
  if [ ! -d "./dist" ] || [ -z "$(ls -A ./dist)" ]; then
    echo "Building application for production..."
    npm run build
  else
    echo "Application build detected, skipping build step."
  fi
fi

# Execute the main command (start the API server)
exec "$@"
