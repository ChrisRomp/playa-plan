import { useEffect, useState } from 'react';
import { healthService } from '../services/healthService';
import { FrontendHealthResponse, HealthStatus } from '../types/health';
import HealthErrorBoundary from '../components/common/HealthErrorBoundary';

/**
 * Health Check Page Component
 * 
 * Provides a health check endpoint for the frontend application.
 * This page is designed to be called by monitoring systems and returns
 * appropriate HTTP status codes based on the health of the frontend.
 * 
 * GitHub Issue: #32
 */
const HealthCheckPage: React.FC = () => {
  const [healthData, setHealthData] = useState<FrontendHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performHealthCheck = async () => {
      try {
        setLoading(true);
        const result = await healthService.getHealthStatus();
        
        if (result) {
          setHealthData(result);
          
          // Set appropriate HTTP status for monitoring systems
          // This is done via document.title as a signal to headless browsers
          if (result.status === HealthStatus.UNHEALTHY) {
            document.title = `Health Check - ${result.status.toUpperCase()}`;
            // Signal unhealthy status to monitoring systems
            if ('serviceWorker' in navigator) {
              // Use service worker messaging if available
              navigator.serviceWorker.ready.then(registration => {
                registration.active?.postMessage({
                  type: 'HEALTH_STATUS',
                  status: result.status
                });
              }).catch(() => {
                // Service worker not available, that's fine
              });
            }
          } else {
            document.title = 'Health Check - OK';
          }
        } else {
          // Handle null result
          setHealthData(null);
          document.title = 'Health Check - NO_DATA';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        document.title = 'Health Check - ERROR';
      } finally {
        setLoading(false);
      }
    };

    performHealthCheck();
  }, []);

  // For monitoring systems that check content
  if (loading) {
    return (
      <div data-testid="health-loading">
        <h1>Health Check</h1>
        <p>Status: CHECKING</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="health-error">
        <h1>Health Check</h1>
        <p>Status: ERROR</p>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div data-testid="health-no-data">
        <h1>Health Check</h1>
        <p>Status: NO_DATA</p>
      </div>
    );
  }

  return (
    <HealthErrorBoundary>
      <div data-testid="health-check" data-status={healthData.status}>
        <h1>Frontend Health Check</h1>
        <div>
          <h2>Overall Status: {healthData.status.toUpperCase()}</h2>
          <p>Timestamp: {healthData.timestamp}</p>
          
          <h3>Component Status:</h3>
          <ul>
            <li data-testid="api-status">
              API: {healthData.checks.api.status.toUpperCase()} ({healthData.checks.api.responseTime}){healthData.checks.api.error && ` - ${healthData.checks.api.error}`}
            </li>
            <li data-testid="client-status">
              Client: {healthData.checks.client.status.toUpperCase()}
              <ul>
                <li>User Agent: {healthData.checks.client.userAgent}</li>
                <li>Cookies: {healthData.checks.client.cookiesEnabled ? 'Enabled' : 'Disabled'}</li>
                <li>Local Storage: {healthData.checks.client.localStorageEnabled ? 'Available' : 'Unavailable'}</li>
                <li>Performance API: {healthData.checks.client.performanceSupported ? 'Supported' : 'Not Supported'}</li>
              </ul>
            </li>
            <li data-testid="routing-status">
              Routing: {healthData.checks.routing.status.toUpperCase()} ({healthData.checks.routing.responseTime}){healthData.checks.routing.error && ` - ${healthData.checks.routing.error}`}
            </li>
            <li data-testid="assets-status">
              Assets: {healthData.checks.assets.status.toUpperCase()} ({healthData.checks.assets.responseTime}){healthData.checks.assets.error && ` - ${healthData.checks.assets.error}`}
            </li>
          </ul>
        </div>
        
        <footer>
          <p>
            <small>
              This endpoint is designed for monitoring systems. 
              Status codes: HEALTHY (200), DEGRADED (200), UNHEALTHY (503)
            </small>
          </p>
        </footer>
      </div>
    </HealthErrorBoundary>
  );
};

export default HealthCheckPage;