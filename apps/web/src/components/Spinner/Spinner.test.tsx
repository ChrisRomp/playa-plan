import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner } from './Spinner';

describe('Spinner Component', () => {
  it('renders correctly with default props', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    
    const svg = spinner.querySelector('svg');
    expect(svg).toHaveClass('h-6');
    expect(svg).toHaveClass('w-6');
    expect(svg).toHaveClass('text-primary-600');
    expect(svg).toHaveClass('animate-spin');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Spinner size="xs" />);
    let svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-3');
    expect(svg).toHaveClass('w-3');

    rerender(<Spinner size="sm" />);
    svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-4');
    expect(svg).toHaveClass('w-4');
    
    rerender(<Spinner size="lg" />);
    svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-8');
    expect(svg).toHaveClass('w-8');
    
    rerender(<Spinner size="xl" />);
    svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-12');
    expect(svg).toHaveClass('w-12');
  });

  it('renders with different colors', () => {
    const { rerender } = render(<Spinner color="secondary" />);
    let svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('text-secondary-600');
    
    rerender(<Spinner color="white" />);
    svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('text-white');
  });

  it('applies additional classes', () => {
    render(<Spinner className="my-custom-class" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('my-custom-class');
  });

  it('includes screen reader text', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });
});
