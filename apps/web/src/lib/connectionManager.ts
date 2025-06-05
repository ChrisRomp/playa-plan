import { api } from './api';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface ConnectionStatus {
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
  lastCheck: number;
}

/**
 * ConnectionManager handles API connection testing and state management
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private connectionState: ConnectionState = 'connecting';
  private lastCheck: number = 0;
  private checkInterval: number = 5000; // 5 seconds
  private timeout: number = 5000; // 5 seconds for connection tests
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Array<(status: ConnectionStatus) => void> = [];

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Test API connection using the auth test endpoint
   * 401 responses indicate the API is working (just not authenticated)
   */
  async testConnection(): Promise<boolean> {
    this.updateConnectionState('connecting');
    
    try {
      // Create a request with a shorter timeout for connection testing
      const response = await api.get('/auth/test', { timeout: this.timeout });
      const isConnected = response.status === 200;
      
      this.updateConnectionState(isConnected ? 'connected' : 'disconnected');
      return isConnected;
    } catch (error) {
      // Check if this is a 401 (unauthorized) - this means API is working
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          // 401 means API is working, user just isn't authenticated
          this.updateConnectionState('connected');
          return true;
        }
      }
      
      const errorMessage = this.getErrorMessage(error);
      this.updateConnectionState('disconnected', errorMessage);
      return false;
    }
  }

  /**
   * Get error message from API error
   */
  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const axiosError = error as { code?: string; message?: string };
      
      switch (axiosError.code) {
        case 'ECONNABORTED':
          return 'Connection timeout - API server may be slow or unreachable';
        case 'ERR_NETWORK':
          return 'Network error - please check your connection';
        case 'ECONNREFUSED':
          return 'Connection refused - API server may be down';
        default:
          return axiosError.message || 'Unable to connect to API server';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'Unknown connection error';
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(state: ConnectionState, error: string | null = null): void {
    this.connectionState = state;
    this.lastCheck = Date.now();
    
    const status: ConnectionStatus = {
      isConnecting: state === 'connecting',
      isConnected: state === 'connected',
      connectionError: error,
      lastCheck: this.lastCheck,
    };

    // Notify all listeners
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Start periodic connection checking
   */
  startPeriodicCheck(): void {
    if (this.intervalId) {
      return; // Already running
    }

    // Initial check
    this.testConnection();

    // Set up periodic checking
    this.intervalId = setInterval(() => {
      // Only check if we're not currently connected or if it's been a while
      const timeSinceLastCheck = Date.now() - this.lastCheck;
      const shouldCheck = this.connectionState !== 'connected' || timeSinceLastCheck > 300000; // 5 minutes

      if (shouldCheck) {
        this.testConnection();
      }
    }, this.checkInterval);
  }

  /**
   * Stop periodic connection checking
   */
  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add a listener for connection state changes
   */
  addListener(listener: (status: ConnectionStatus) => void): void {
    this.listeners.push(listener);
    
    // Immediately notify with current state
    const currentStatus: ConnectionStatus = {
      isConnecting: this.connectionState === 'connecting',
      isConnected: this.connectionState === 'connected',
      connectionError: this.connectionState === 'disconnected' ? 'Connection failed' : null,
      lastCheck: this.lastCheck,
    };
    listener(currentStatus);
  }

  /**
   * Remove a listener for connection state changes
   */
  removeListener(listener: (status: ConnectionStatus) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return {
      isConnecting: this.connectionState === 'connecting',
      isConnected: this.connectionState === 'connected',
      connectionError: this.connectionState === 'disconnected' ? 'Connection failed' : null,
      lastCheck: this.lastCheck,
    };
  }

  /**
   * Force a connection check
   */
  async checkConnection(): Promise<boolean> {
    this.updateConnectionState('connecting');
    return await this.testConnection();
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance(); 