# Health Check Module

## Overview

The Health Check module provides comprehensive monitoring capabilities for the PlayaPlan API, enabling monitoring systems to assess the health and availability of critical services.

**GitHub Issue:** #31

## Endpoint

- **URL:** `/health`
- **Method:** GET
- **Authentication:** Public (no authentication required)
- **Timeout:** 5 seconds maximum

## Response Codes

- **200 OK:** System is healthy or degraded but functional
- **503 Service Unavailable:** System is unhealthy and may not function properly

## Health Checks

### Database Connectivity
- Tests PostgreSQL connection via Prisma ORM
- Executes a simple `SELECT 1` query
- Timeout: 3 seconds

### Payment Services
- **Stripe API:** Tests connectivity to Stripe API
- **PayPal API:** Tests connectivity to PayPal API
- Returns degraded if one service fails, unhealthy if both fail
- Timeout: 2 seconds per service

### Email Service
- Validates email service configuration
- Returns degraded if not configured properly

### System Resources
- **Memory Usage:** Monitors heap memory utilization
- **Uptime:** Reports process uptime
- Returns unhealthy if memory usage > 95%, degraded if > 90%

## Response Format

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-08-11T12:34:56.789Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": "15ms"
    },
    "payments": {
      "status": "healthy", 
      "responseTime": "120ms"
    },
    "email": {
      "status": "healthy",
      "responseTime": "5ms"
    },
    "system": {
      "status": "healthy",
      "memoryUsage": "65%",
      "uptime": "2d 4h 15m"
    }
  }
}
```

### Error Response Format

When individual checks fail, the response includes error details:

```json
{
  "status": "unhealthy",
  "timestamp": "2025-08-11T12:34:56.789Z", 
  "checks": {
    "database": {
      "status": "unhealthy",
      "responseTime": "3000ms",
      "error": "Database connectivity failed"
    }
  }
}
```

## Security Considerations

### Information Disclosure Prevention
- No sensitive configuration details exposed
- Generic error messages to prevent reconnaissance
- No system paths, versions, or internal details revealed
- Response times limited to prevent timing attacks

### Rate Limiting
- Health checks are subject to the same rate limiting as other GET requests
- Monitoring systems should implement appropriate request intervals

## Monitoring Integration

### Kubernetes/Docker
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 2
```

### Prometheus Monitoring
```yaml
- job_name: 'api-health'
  static_configs:
    - targets: ['api:3000']
  metrics_path: '/health'
  scrape_interval: 30s
  scrape_timeout: 5s
```

## Development

### Running Tests
```bash
# Unit tests
npm run test -- apps/api/src/health

# Integration tests  
npm run test:e2e -- --testPathPattern=health
```

### Local Testing
```bash
# Test endpoint
curl http://localhost:3000/health

# Test with timeout
curl --max-time 5 http://localhost:3000/health
```

## Implementation Details

### Module Structure
- `HealthModule`: NestJS module configuration
- `HealthController`: HTTP endpoint handler
- `HealthService`: Business logic for health checks
- `HealthResponseDto`: Type definitions for responses

### Concurrent Execution
All health checks execute concurrently using `Promise.allSettled()` to minimize response time and prevent cascading failures.

### Error Handling
Individual check failures are isolated and don't prevent other checks from completing. The overall status reflects the worst individual status.