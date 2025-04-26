import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlertBox } from './AlertBox';

describe('AlertBox Component', () => {
  it('renders correctly with default props', () => {
    render(<AlertBox>Alert message</AlertBox>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('bg-primary-50');
    expect(alert).toHaveClass('text-primary-800');
    expect(screen.getByText('Alert message')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<AlertBox variant="success">Success message</AlertBox>);
    let alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-success-50');
    expect(alert).toHaveClass('text-success-800');

    rerender(<AlertBox variant="warning">Warning message</AlertBox>);
    alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-warning-50');
    expect(alert).toHaveClass('text-warning-800');

    rerender(<AlertBox variant="danger">Error message</AlertBox>);
    alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-danger-50');
    expect(alert).toHaveClass('text-danger-800');
  });

  it('renders with title', () => {
    render(<AlertBox title="Alert Title">Alert message</AlertBox>);
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
    expect(screen.getByText('Alert message')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    render(
      <AlertBox icon={<span data-testid="custom-icon">🔔</span>}>
        Alert with icon
      </AlertBox>
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Alert with icon')).toBeInTheDocument();
  });

  it('renders with dismiss button and calls onDismiss', () => {
    const handleDismiss = vi.fn();
    render(
      <AlertBox dismissible onDismiss={handleDismiss}>
        Dismissible alert
      </AlertBox>
    );
    
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when dismissible is false', () => {
    const handleDismiss = vi.fn();
    render(
      <AlertBox dismissible={false} onDismiss={handleDismiss}>
        Non-dismissible alert
      </AlertBox>
    );
    
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('applies additional classes', () => {
    render(<AlertBox className="my-custom-class">Alert with custom class</AlertBox>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('my-custom-class');
  });
});
