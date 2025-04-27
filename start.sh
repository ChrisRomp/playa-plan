#!/bin/bash

# Stop any running containers and processes
echo "🛑 Stopping any running containers and processes..."
docker-compose down
pkill -f "node" || true

# Export environment variables from .env file
echo "🔄 Loading environment variables..."
export $(grep -v '^#' .env | xargs)

# Start PostgreSQL container
echo "🐘 Starting PostgreSQL..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "📝 Setting up the database..."
cd apps/api

# Fix the Tailwind CSS issue in the web app
echo "🎨 Installing correct Tailwind CSS packages..."
cd ../web
npm install -D @tailwindcss/postcss autoprefixer postcss

# Update the postcss.config.js file
echo "🔧 Updating PostCSS configuration..."
cat > postcss.config.js << EOL
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
EOL

# Run database migrations
echo "🔄 Running Prisma migrations..."
cd ../api
npx prisma migrate dev || echo "Migration already exists"

# Generate Prisma client
echo "⚙️ Generating Prisma client..."
npx prisma generate

# Build the API
echo "🏗️ Building the API..."
npm run build

# Start the application in the background
echo "🚀 Starting the API server..."
cd ../..
node dist/api/apps/api/src/main.js &
API_PID=$!

# Start the frontend
echo "🚀 Starting the frontend..."
cd apps/web
npm run dev &
WEB_PID=$!

echo ""
echo "✅ Application is now running!"
echo "🔗 API server: http://localhost:3000"
echo "🔗 Frontend: http://localhost:5173 (or check the console output for exact port)"
echo ""
echo "📋 How to use:"
echo "1. Access the frontend in your browser"
echo "2. API documentation is available at http://localhost:3000/api"
echo "3. To stop the application, run: kill $API_PID $WEB_PID"
echo ""
echo "⚠️ If you encounter any issues:"
echo "- Check that environment variables are properly set in .env"
echo "- Ensure PostgreSQL is running with 'docker ps'"
echo "- For Tailwind issues, run 'cd apps/web && npm install -D @tailwindcss/postcss'"
echo ""

# Keep the script running
wait 