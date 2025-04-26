import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders correctly with default props', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary-100');
    expect(badge).toHaveClass('text-primary-700');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="secondary">Secondary</Badge>);
    let badge = screen.getByText('Secondary');
    expect(badge).toHaveClass('bg-secondary-100');

    rerender(<Badge variant="success">Success</Badge>);
    badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-success-100');
    expect(badge).toHaveClass('text-success-700');

    rerender(<Badge variant="danger">Danger</Badge>);
    badge = screen.getByText('Danger');
    expect(badge).toHaveClass('bg-danger-100');

    rerender(<Badge variant="warning">Warning</Badge>);
    badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-warning-100');

    rerender(<Badge variant="info">Info</Badge>);
    badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-primary-50');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    let badge = screen.getByText('Small');
    expect(badge).toHaveClass('text-xs');

    rerender(<Badge size="md">Medium</Badge>);
    badge = screen.getByText('Medium');
    expect(badge).toHaveClass('text-sm');

    rerender(<Badge size="lg">Large</Badge>);
    badge = screen.getByText('Large');
    expect(badge).toHaveClass('text-base');
  });

  it('renders with rounded style when specified', () => {
    render(<Badge rounded>Rounded</Badge>);
    const badge = screen.getByText('Rounded');
    expect(badge).toHaveClass('rounded-full');
  });

  it('renders with outline style when specified', () => {
    const { rerender } = render(<Badge outline>Outline</Badge>);
    let badge = screen.getByText('Outline');
    expect(badge).toHaveClass('bg-transparent');
    expect(badge).toHaveClass('border');

    rerender(<Badge variant="success" outline>Success Outline</Badge>);
    badge = screen.getByText('Success Outline');
    expect(badge).toHaveClass('bg-transparent');
    expect(badge).toHaveClass('border-success-500');
  });

  it('combines custom classes with badge classes', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
    expect(badge).toHaveClass('bg-primary-100');
  });
});
