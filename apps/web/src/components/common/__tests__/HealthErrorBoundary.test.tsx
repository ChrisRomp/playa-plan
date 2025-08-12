import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HealthErrorBoundary from '../HealthErrorBoundary';
import { HealthStatus } from '../../../types/health';

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error for error boundary');
  }
  return <div>Normal component</div>;
};

describe('HealthErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document title
    document.title = 'Test';
    // Reset body attributes
    document.body.removeAttribute('data-health-status');
    
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error occurs', () => {
    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={false} />
      </HealthErrorBoundary>
    );

    expect(screen.getByText('Normal component')).toBeInTheDocument();
    expect(screen.queryByTestId('health-error-boundary')).not.toBeInTheDocument();
  });

  it('should catch and display error when child component throws', () => {
    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    expect(screen.getByTestId('health-error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Overall Status: ERROR')).toBeInTheDocument();
    expect(screen.getByText('A JavaScript error occurred in the health check system.')).toBeInTheDocument();
    expect(document.title).toBe('Health Check - ERROR');
  });

  it('should set unhealthy status attribute', () => {
    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    const errorBoundary = screen.getByTestId('health-error-boundary');
    expect(errorBoundary).toHaveAttribute('data-status', HealthStatus.UNHEALTHY);
  });

  it('should display error components status as ERROR', () => {
    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    expect(screen.getByTestId('api-status')).toHaveTextContent('API: ERROR - Unable to check due to JavaScript error');
    expect(screen.getByTestId('client-status')).toHaveTextContent('Client: ERROR - Unable to check due to JavaScript error');
    expect(screen.getByTestId('routing-status')).toHaveTextContent('Routing: ERROR - Unable to check due to JavaScript error');
    expect(screen.getByTestId('assets-status')).toHaveTextContent('Assets: ERROR - Unable to check due to JavaScript error');
  });

  it('should include error details in technical section', () => {
    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    expect(screen.getByText('Technical Details (for debugging)')).toBeInTheDocument();
    expect(screen.getByText(/Test error for error boundary/)).toBeInTheDocument();
  });

  it('should include reload button', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload health check/i });
    expect(reloadButton).toBeInTheDocument();
    
    reloadButton.click();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('should display timestamp when error occurs', () => {
    // Mock Date to have consistent timestamp
    const mockDate = new Date('2023-01-01T12:00:00.000Z');
    vi.setSystemTime(mockDate);

    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    expect(screen.getByText('Timestamp: 2023-01-01T12:00:00.000Z')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('should handle case where body attribute setting fails', () => {
    // Mock document.body to throw when setting attributes
    const originalSetAttribute = document.body.setAttribute;
    document.body.setAttribute = vi.fn().mockImplementation(() => {
      throw new Error('Cannot set attribute');
    });

    // Should not throw even if attribute setting fails
    expect(() => {
      render(
        <HealthErrorBoundary>
          <ThrowError shouldThrow={true} />
        </HealthErrorBoundary>
      );
    }).not.toThrow();

    expect(screen.getByTestId('health-error-boundary')).toBeInTheDocument();
    
    // Restore original method
    document.body.setAttribute = originalSetAttribute;
  });

  it('should log error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error');

    render(
      <HealthErrorBoundary>
        <ThrowError shouldThrow={true} />
      </HealthErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Health check error boundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });
});