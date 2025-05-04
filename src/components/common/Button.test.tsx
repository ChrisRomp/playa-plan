import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Button from './Button';

describe('Button Component', () => {
  it('should render with default props', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-600');
  });

  it('should apply variant classes correctly', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByRole('button', { name: /secondary button/i });
    expect(button).toHaveClass('bg-gray-200');
    expect(button).not.toHaveClass('bg-blue-600');
  });

  it('should show loading state when isLoading is true', () => {
    render(<Button isLoading>Loading Button</Button>);
    const button = screen.getByRole('button', { name: /loading button/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-70');
    
    const loadingSpinner = document.querySelector('svg.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await userEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled Button</Button>);
    
    const button = screen.getByRole('button', { name: /disabled button/i });
    await userEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('should render with fullWidth when specified', () => {
    render(<Button fullWidth>Full Width Button</Button>);
    const button = screen.getByRole('button', { name: /full width button/i });
    expect(button).toHaveClass('w-full');
  });

  it('should render with icon when provided', () => {
    const iconElement = <span data-testid="test-icon">★</span>;
    render(<Button icon={iconElement}>Icon Button</Button>);
    
    const button = screen.getByRole('button', { name: /icon button/i });
    const icon = screen.getByTestId('test-icon');
    
    expect(icon).toBeInTheDocument();
    expect(button).toContainElement(icon);
  });
}); 