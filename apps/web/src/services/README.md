# Frontend Health Check System

## Overview

The Frontend Health Check system provides comprehensive monitoring capabilities for the PlayaPlan web application, enabling monitoring systems to assess the health and availability of the client-side application.

**GitHub Issue:** #32

## Endpoint

- **URL:** `/health`
- **Method:** GET (Browser Navigation)
- **Authentication:** Public (no authentication required)
- **Response:** HTML page with structured data attributes

## Health Checks

### API Connectivity
- Tests connection to the backend API health endpoint
- Verifies authentication and API availability
- Timeout: 5 seconds

### Client Capabilities
- **Browser Features:** Checks cookies, localStorage, Performance API
- **User Agent:** Safe extraction of browser and OS information
- **JavaScript:** Validates core browser capabilities

### Routing System
- **React Router:** Validates routing functionality
- **History API:** Ensures browser navigation support
- **Current Route:** Validates route path format

### Asset Loading
- **Stylesheets:** Ensures CSS assets are loaded
- **Scripts:** Validates JavaScript bundles are loaded
- **Document State:** Checks document readiness

## Response Format

### HTML Structure
```html
<div data-testid="health-check" data-status="healthy|degraded|unhealthy">
  <h1>Frontend Health Check</h1>
  <h2>Overall Status: HEALTHY</h2>
  <p>Timestamp: 2025-08-11T12:34:56.789Z</p>
  
  <h3>Component Status:</h3>
  <ul>
    <li data-testid="api-status">API: HEALTHY (120ms)</li>
    <li data-testid="client-status">Client: HEALTHY</li>
    <li data-testid="routing-status">Routing: HEALTHY (5ms)</li>
    <li data-testid="assets-status">Assets: HEALTHY (10ms)</li>
  </ul>
</div>
```

### Status Indicators
- **Document Title:** Set to `"Health Check - [STATUS]"`
- **Data Attributes:** `data-status` on main container
- **Body Attribute:** `data-health-status` for monitoring systems

## Error Handling

### Error Boundary
- Catches JavaScript errors in health check components
- Provides fallback UI with error status
- Maintains monitoring system compatibility
- Includes reload functionality

### Graceful Degradation
- Individual check failures don't prevent other checks
- Timeouts handled gracefully
- Fallback responses for missing browser features

## Security Considerations

### Information Disclosure Prevention
- User agent sanitization (only browser/OS, no versions/plugins)
- No internal system information exposed
- Generic error messages prevent reconnaissance
- No sensitive configuration details revealed

### Privacy Protection
- No user-specific information collected
- No tracking or analytics in health checks
- Minimal browser fingerprinting

## Monitoring Integration

### Headless Browser Monitoring
```javascript
// Puppeteer/Playwright example
const page = await browser.newPage();
await page.goto('https://your-app.com/health');

// Check overall status
const status = await page.getAttribute('[data-testid="health-check"]', 'data-status');
const isHealthy = status === 'healthy';

// Check specific components  
const apiStatus = await page.textContent('[data-testid="api-status"]');
const clientStatus = await page.textContent('[data-testid="client-status"]');
```

### Uptime Monitoring Services
```yaml
# Example configuration for monitoring services
url: https://your-app.com/health
expected_status: 200
expected_text: "Overall Status: HEALTHY"
timeout: 10s
interval: 60s
```

### Custom Monitoring Scripts
```bash
#!/bin/bash
# Check frontend health
RESPONSE=$(curl -s "https://your-app.com/health")
if echo "$RESPONSE" | grep -q "Overall Status: HEALTHY"; then
  echo "Frontend is healthy"
  exit 0
else
  echo "Frontend is not healthy"
  exit 1
fi
```

## Development

### Running Tests
```bash
# Unit tests
npm run test -- src/services/healthService.test.ts
npm run test -- src/pages/__tests__/HealthCheckPage.test.tsx
npm run test -- src/components/common/__tests__/HealthErrorBoundary.test.tsx

# Integration tests
npm run test:e2e -- --grep "health"
```

### Local Testing
```bash
# Start development server
npm run dev

# Test endpoint
curl http://localhost:5173/health
# or visit in browser: http://localhost:5173/health
```

### Manual Testing Scenarios
1. **Normal Operation:** Visit `/health` - should show all healthy
2. **API Down:** Stop backend API - should show API unhealthy
3. **JavaScript Error:** Modify code to throw error - should show error boundary
4. **Disabled Features:** Disable cookies/localStorage in browser - should show degraded

## Implementation Details

### Architecture
- **HealthService:** Core business logic for health checks
- **HealthCheckPage:** React component for UI rendering  
- **HealthErrorBoundary:** Error boundary for fault tolerance
- **Type Definitions:** TypeScript interfaces for type safety

### Performance Considerations
- Concurrent execution of all health checks
- Timeouts prevent hanging requests
- Minimal impact on application startup
- Lazy loading of health check components

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Gracefully handles missing browser features
- No external dependencies required
- Progressive enhancement approach

## Status Interpretation

### HEALTHY
- All systems operational
- API connectivity working
- Browser capabilities sufficient
- All assets loaded correctly

### DEGRADED
- Core functionality working
- Some non-critical features unavailable
- Minor browser capability issues
- May affect user experience but app is usable

### UNHEALTHY
- Critical system failures
- API completely unavailable
- Major browser compatibility issues
- Assets failed to load - app may be unusable

Use DEGRADED vs UNHEALTHY to determine if the application is still usable for end users.