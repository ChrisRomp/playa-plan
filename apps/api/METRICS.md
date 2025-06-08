# Prometheus Metrics Setup

## Overview

The API now runs two separate servers:

1. **Main API Server** (Port 3000) - Public-facing application
2. **Metrics Server** (Port 9464) - Internal metrics for monitoring

## Configuration

### Main API Server
- **Port:** 3000 (exposed via Cloudflare tunnels)
- **Endpoints:** All application routes (`/api/*`, `/health`, etc.)
- **Access:** Public via `api-test.playaplan.app`

### Metrics Server  
- **Port:** 9464 (internal Docker networking only)
- **Endpoint:** `/metrics`
- **Access:** Internal only (`api:9464/metrics`)
- **Purpose:** Prometheus scraping

## Available Metrics

### Default Node.js Metrics
- `process_cpu_user_seconds_total` - CPU time spent in user mode
- `process_cpu_system_seconds_total` - CPU time spent in system mode
- `process_cpu_seconds_total` - Total CPU time
- `process_start_time_seconds` - Process start time
- `process_resident_memory_bytes` - Resident memory size
- `process_virtual_memory_bytes` - Virtual memory size
- `process_heap_bytes` - Process heap size
- `process_open_fds` - Number of open file descriptors
- `process_max_fds` - Maximum number of open file descriptors
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles_total` - Number of active handles
- `nodejs_active_requests_total` - Number of active requests
- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_heap_size_used_bytes` - Used heap size
- `nodejs_external_memory_bytes` - External memory
- `nodejs_heap_space_size_total_bytes` - Heap space size
- `nodejs_heap_space_size_used_bytes` - Used heap space size
- `nodejs_heap_space_size_available_bytes` - Available heap space
- `nodejs_version_info` - Node.js version information
- `nodejs_gc_duration_seconds` - Garbage collection duration

### HTTP Metrics (Auto-generated)
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - HTTP request duration histogram

### Labels
All metrics include:
- `app: "playa-plan-api"`
- `environment: "development|production"`

## Docker Compose Configuration

```yaml
# In your prometheus.yml scrape config:
- job_name: 'api'
  static_configs:
    - targets: ['api:9464']  # Internal metrics port
  metrics_path: '/metrics'
```

## Security

✅ **Secure Setup:**
- Main API (port 3000): Exposed via CF tunnels
- Metrics (port 9464): Internal Docker network only
- No public access to metrics data

❌ **Previous Setup (insecure):**
- Metrics on same port as API: `api-test.playaplan.app/metrics`
- Publicly accessible metrics data

## Testing

```bash
# Test main API (should work via CF tunnel)
curl https://api-test.playaplan.app/health

# Test metrics (only works inside Docker network)
curl http://api:9464/metrics
```

## Adding Custom Metrics

To add custom application metrics, inject metric providers in your services:

```typescript
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  providers: [
    makeCounterProvider({
      name: 'api_custom_counter',
      help: 'Custom counter metric',
    }),
  ],
})
export class SomeModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class SomeService {
  constructor(
    @InjectMetric('api_custom_counter') 
    private counter: Counter<string>
  ) {}

  someMethod() {
    this.counter.inc({ label: 'value' });
  }
}
``` 