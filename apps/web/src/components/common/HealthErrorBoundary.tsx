import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HealthStatus } from '../../types/health';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary for Health Check functionality
 * 
 * Catches JavaScript errors in the health check components
 * and provides a fallback UI that maintains health check functionality
 * for monitoring systems.
 * 
 * GitHub Issue: #32
 */
class HealthErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Health check error boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Signal unhealthy status to monitoring systems
    document.title = 'Health Check - ERROR';
    
    // Try to set a data attribute on body for monitoring systems
    try {
      document.body.setAttribute('data-health-status', HealthStatus.UNHEALTHY);
    } catch {
      // If we can't set attributes, that's fine
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div data-testid="health-error-boundary" data-status={HealthStatus.UNHEALTHY}>
          <h1>Frontend Health Check</h1>
          <div>
            <h2>Overall Status: ERROR</h2>
            <p>Timestamp: {new Date().toISOString()}</p>
            
            <h3>Error Details:</h3>
            <p>A JavaScript error occurred in the health check system.</p>
            
            <details style={{ marginTop: '1rem' }}>
              <summary>Technical Details (for debugging)</summary>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '1rem', 
                marginTop: '0.5rem',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
            
            <h3>Component Status:</h3>
            <ul>
              <li data-testid="api-status">API: ERROR - Unable to check due to JavaScript error</li>
              <li data-testid="client-status">Client: ERROR - Unable to check due to JavaScript error</li>
              <li data-testid="routing-status">Routing: ERROR - Unable to check due to JavaScript error</li>
              <li data-testid="assets-status">Assets: ERROR - Unable to check due to JavaScript error</li>
            </ul>
          </div>
          
          <footer>
            <p>
              <small>
                JavaScript error occurred in health check system. 
                Status: ERROR (HTTP 503 equivalent)
              </small>
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{ 
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload Health Check
            </button>
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}

export default HealthErrorBoundary;