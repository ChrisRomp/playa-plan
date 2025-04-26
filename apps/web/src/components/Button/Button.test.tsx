import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('should render correctly with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary-600'); // Primary variant
  });

  it('should render with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: /secondary/i });
    expect(button).toHaveClass('bg-secondary-200');
  });

  it('should render with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button', { name: /outline/i });
    expect(button).toHaveClass('bg-transparent');
    expect(button).toHaveClass('border');
  });

  it('should render with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: /ghost/i });
    expect(button).toHaveClass('bg-transparent');
    expect(button).not.toHaveClass('border');
  });

  it('should render with danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button', { name: /danger/i });
    expect(button).toHaveClass('bg-danger-600');
  });

  it('should render with success variant', () => {
    render(<Button variant="success">Success</Button>);
    const button = screen.getByRole('button', { name: /success/i });
    expect(button).toHaveClass('bg-success-600');
  });

  it('should render with warning variant', () => {
    render(<Button variant="warning">Warning</Button>);
    const button = screen.getByRole('button', { name: /warning/i });
    expect(button).toHaveClass('bg-warning-500');
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<Button size="xs">Extra Small</Button>);
    let button = screen.getByRole('button', { name: /extra small/i });
    expect(button).toHaveClass('px-2');
    expect(button).toHaveClass('text-xs');

    rerender(<Button size="sm">Small</Button>);
    button = screen.getByRole('button', { name: /small/i });
    expect(button).toHaveClass('text-sm');

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole('button', { name: /large/i });
    expect(button).toHaveClass('text-lg');

    rerender(<Button size="xl">Extra Large</Button>);
    button = screen.getByRole('button', { name: /extra large/i });
    expect(button).toHaveClass('text-xl');
  });

  it('should render with rounded corners when rounded is true', () => {
    render(<Button rounded>Rounded Button</Button>);
    const button = screen.getByRole('button', { name: /rounded button/i });
    expect(button).toHaveClass('rounded-full');
  });

  it('should render full width when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    const button = screen.getByRole('button', { name: /full width/i });
    expect(button).toHaveClass('w-full');
  });

  it('should render with left icon', () => {
    render(<Button leftIcon={<span data-testid="left-icon" />}>With Icon</Button>);
    const icon = screen.getByTestId('left-icon');
    expect(icon).toBeInTheDocument();
    const iconContainer = icon.parentElement;
    expect(iconContainer).toHaveClass('mr-2');
  });

  it('should render with right icon', () => {
    render(<Button rightIcon={<span data-testid="right-icon" />}>With Icon</Button>);
    const icon = screen.getByTestId('right-icon');
    expect(icon).toBeInTheDocument();
    const iconContainer = icon.parentElement;
    expect(iconContainer).toHaveClass('ml-2');
  });

  it('should show loading state', () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveClass('opacity-70');
    expect(screen.getByText('Loading')).toBeInTheDocument();
    // Check if loading icon exists
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
  });

  it('should call onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
}); 