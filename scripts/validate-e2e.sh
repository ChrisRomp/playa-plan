#!/bin/bash

# Quick validation script to test service startup without running full e2e tests

set -e

echo "🔍 Validating E2E Infrastructure Setup"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if required files exist
print_status "Checking configuration files..."
test -f playwright.config.ts && print_status "Playwright config found"
test -f .github/workflows/e2e-ci.yml && print_status "CI workflow found"
test -f docker-compose.e2e.yml && print_status "Docker Compose config found"
test -f scripts/test-e2e.sh && print_status "Test script found"

# Check if dependencies are available
print_status "Checking dependencies..."
command -v node >/dev/null 2>&1 && print_status "Node.js available"
command -v npm >/dev/null 2>&1 && print_status "npm available"
command -v docker >/dev/null 2>&1 && print_status "Docker available"

# Check npm scripts
print_status "Checking npm scripts..."
npm run --help | grep -q "test:e2e" && print_status "test:e2e script available"
npm run --help | grep -q "test:e2e:local" && print_status "test:e2e:local script available"
npm run --help | grep -q "test:e2e:docker" && print_status "test:e2e:docker script available"

# Validate Playwright config
print_status "Validating Playwright configuration..."
if node -e "
try {
  const config = require('./playwright.config.ts');
  console.log('✓ Playwright config is valid');
  if (process.env.CI && !config.default.webServer) {
    console.log('✓ webServer correctly disabled in CI');
  } else if (!process.env.CI && config.default.webServer) {
    console.log('✓ webServer enabled for local development');
  }
} catch (e) {
  console.error('✗ Playwright config error:', e.message);
  process.exit(1);
}"; then
  print_status "Playwright config validation passed"
fi

# Test Docker Compose syntax
print_status "Validating Docker Compose configuration..."
if docker compose -f docker-compose.e2e.yml config >/dev/null 2>&1; then
  print_status "Docker Compose config is valid"
elif docker-compose -f docker-compose.e2e.yml config >/dev/null 2>&1; then
  print_status "Docker Compose config is valid (legacy syntax)"
else
  print_error "Docker Compose config has issues"
fi

# Test script permissions
if [ -x scripts/test-e2e.sh ]; then
  print_status "Test script is executable"
else
  print_warning "Test script needs execute permissions"
  chmod +x scripts/test-e2e.sh
  print_status "Fixed test script permissions"
fi

print_status "Basic validation completed successfully!"

echo ""
echo "🚀 Ready to run e2e tests with:"
echo "  npm run test:e2e:local   # Manual service coordination"
echo "  npm run test:e2e:docker  # Docker Compose"
echo "  npm run test:e2e         # Standard Playwright (local dev)"