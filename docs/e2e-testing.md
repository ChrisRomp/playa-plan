# End-to-End Testing Guide

This document describes the end-to-end (e2e) testing setup for PlayaPlan.

## Overview

We use Playwright for e2e testing with two different approaches:

1. **Manual Service Management**: Better control, explicit service coordination
2. **Docker Compose**: Simplified orchestration, isolated environment

## Quick Start

### Local Development

```bash
# Run e2e tests locally (uses webServer in Playwright config)
npm run test:e2e

# Run with headed browser for debugging
npm run test:e2e:headed

# Run with Playwright UI mode
npm run test:e2e:ui

# Run with manual service coordination (more like CI)
npm run test:e2e:local

# Run with Docker Compose (most like production)
npm run test:e2e:docker
```

### CI Environment

The CI uses manual service coordination for better control:

```bash
# This is what runs in GitHub Actions
npm run test:e2e:ci
```

## Architecture

### Manual Service Management (CI and `test:e2e:local`)

1. **PostgreSQL**: Started via Docker or service
2. **API Server**: Started manually with proper environment variables
3. **Web Server**: Started manually after API is ready
4. **Health Checks**: Wait for each service before proceeding
5. **Tests**: Run against manually coordinated services
6. **Cleanup**: Stop all services and clean up

**Pros:**
- Full control over service startup order
- Better debugging capabilities
- More explicit error handling
- Matches production deployment patterns

**Cons:**
- More complex setup
- More potential for environment drift

### Docker Compose (`test:e2e:docker`)

1. **All Services**: Defined in `docker-compose.e2e.yml`
2. **Health Checks**: Built into service definitions
3. **Service Dependencies**: Automatically managed
4. **Environment**: Fully isolated and reproducible

**Pros:**
- Simplified orchestration
- Consistent environment
- Easy to reproduce issues
- Better isolation

**Cons:**
- Less control over individual services
- Harder to debug individual components
- Requires Docker build step

## Configuration Files

### `playwright.config.ts`

- **CI Mode**: Disables `webServer`, expects services to be managed externally
- **Local Mode**: Uses `webServer` to start `npm run dev` automatically
- **Browser Config**: Optimized for CI with appropriate flags

### `.github/workflows/e2e-ci.yml`

- **Primary CI workflow**: Uses manual service management
- **PostgreSQL Service**: GitHub Actions service container
- **Database Setup**: Prisma migrations and seeding
- **Service Coordination**: Explicit startup order with health checks

### `.github/workflows/e2e-docker-ci.yml`

- **Alternative CI workflow**: Uses Docker Compose (manual trigger only)
- **Full Docker Stack**: All services in containers
- **Health Checks**: Built into Docker Compose

### `docker-compose.e2e.yml`

- **PostgreSQL**: Standard postgres:15 image
- **API**: Built from Dockerfile with development target
- **Web**: Built from Dockerfile with development target
- **Health Checks**: All services have proper health check definitions

## Environment Variables

### Required for Testing

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playaplan_test
JWT_SECRET=test-secret-key-for-ci
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

### CI-Specific Variables

The CI workflows automatically set up the correct environment variables for testing.

## Debugging

### Local Debugging

1. **Use headed mode**: `npm run test:e2e:headed`
2. **Use UI mode**: `npm run test:e2e:ui`
3. **Check service logs**: Look at `api.log` and `web.log` files
4. **Use debug mode**: `DEBUG=pw:api npm run test:e2e`

### CI Debugging

1. **Check workflow logs**: Look at the "Show server logs on failure" step
2. **Download artifacts**: Playwright reports and test results are uploaded
3. **Service status**: CI shows service startup logs and health check results

### Common Issues

**Services not starting:**
- Check port conflicts (5432, 3000, 5173)
- Verify environment variables are set correctly
- Check database connectivity

**Tests timing out:**
- Increase timeouts in `playwright.config.ts`
- Check if services are actually ready
- Verify health check endpoints

**Database issues:**
- Ensure PostgreSQL is running and accessible
- Check if migrations have been applied
- Verify database seeding completed

## Scripts

### `scripts/test-e2e.sh`

Comprehensive e2e test runner that:
- Detects Docker vs manual mode
- Sets up environment
- Starts services in correct order
- Waits for health checks
- Runs tests
- Cleans up properly

**Usage:**
```bash
# Manual mode (default)
./scripts/test-e2e.sh

# Docker mode
USE_DOCKER=true ./scripts/test-e2e.sh

# With Playwright options
./scripts/test-e2e.sh --headed --project=chromium
```

## Best Practices

1. **Always use health checks**: Don't assume services are ready immediately
2. **Proper cleanup**: Always stop services and clean up resources
3. **Environment isolation**: Use test-specific environment variables
4. **Debugging friendly**: Keep logs and make them accessible
5. **Consistent setup**: Use the same environment variables across all test modes

## Troubleshooting

### Service Startup Issues

```bash
# Check if ports are available
netstat -tlnp | grep -E "(3000|5173|5432)"

# Check service logs
tail -f api.log
tail -f web.log

# Test service health directly
curl http://localhost:3000/health
curl http://localhost:5173
```

### Database Issues

```bash
# Test database connection
PGPASSWORD=postgres psql -h localhost -U postgres -d playaplan_test -c "SELECT 1;"

# Check if migrations are applied
cd apps/api
npx prisma db status
```

### Environment Issues

```bash
# Check environment variables
env | grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV|PORT|VITE_API_URL)"

# Verify test environment file
cat .env.test
```

## Contributing

When adding new tests:

1. **Follow existing patterns**: Use the same setup/teardown approach
2. **Add proper waits**: Always wait for elements/conditions
3. **Test error scenarios**: Include negative test cases
4. **Keep tests isolated**: Each test should be independent
5. **Update documentation**: Add notes about new test requirements