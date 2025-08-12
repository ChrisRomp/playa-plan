# Static Health Endpoint Configuration

## Overview

The `/health` endpoint serves a static HTML page with embedded JavaScript that performs client-side health checks. This approach provides monitoring-system compatibility while preserving the interactive React health check at `/#/health`.

## Development Server (Vite)

The Vite development server is configured with a custom middleware to serve `/health` directly from `public/health.html`.

## Production Deployment

### Nginx Configuration
```nginx
location = /health {
    try_files /health.html =404;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

# Ensure the React app still handles hash routes
location / {
    try_files $uri $uri/ /index.html;
}
```

### Apache Configuration
```apache
# Serve health endpoint directly
RewriteRule ^health$ /health.html [L]

# Ensure React routing works
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Docker/Static Hosting

Ensure `public/health.html` is included in the build output and served at `/health` path.

For static hosting services (Netlify, Vercel, etc.), add redirect rules:
- `/health` → `/health.html` (200 status, not redirect)

### CDN Configuration

Disable caching for the health endpoint:
```
/health: Cache-Control: no-cache
```

## Monitoring Integration

The static endpoint is compatible with:
- curl/wget: `curl http://localhost:5173/health`
- Uptime monitoring services
- Load balancer health checks
- Kubernetes liveness/readiness probes

Example Kubernetes probe:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 80
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Response Format

The endpoint returns HTML with:
- `data-status` attribute on body (healthy/degraded/unhealthy)
- `data-testid` attributes for programmatic parsing
- Document title updates for monitoring
- Structured component status in list format

This provides both human-readable and machine-parseable health information.