import { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps the component with a BrowserRouter
 * for testing components that use react-router-dom hooks
 */
export function renderWithRouter(
  ui: ReactElement,
  { route = '/' } = {}
) {
  window.history.pushState({}, 'Test page', route);
  
  return render(ui, { wrapper: BrowserRouter });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'; 