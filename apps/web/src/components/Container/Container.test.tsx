import { render, screen } from '@testing-library/react';
import { Container } from './Container';
import { describe, it, expect } from 'vitest';

describe('Container', () => {
  it('renders children correctly', () => {
    render(<Container>Test content</Container>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies default size class', () => {
    render(<Container>Default container</Container>);
    const container = screen.getByText('Default container').parentElement;
    expect(container).toHaveClass('max-w-screen-xl');
  });

  it('applies different size classes', () => {
    const { rerender } = render(<Container size="xs">XS container</Container>);
    let container = screen.getByText('XS container').parentElement;
    expect(container).toHaveClass('max-w-screen-sm');

    rerender(<Container size="md">MD container</Container>);
    container = screen.getByText('MD container').parentElement;
    expect(container).toHaveClass('max-w-screen-lg');

    rerender(<Container size="full">Full container</Container>);
    container = screen.getByText('Full container').parentElement;
    expect(container).toHaveClass('max-w-full');
  });

  it('applies padding classes correctly', () => {
    const { rerender } = render(<Container>Default padding</Container>);
    let container = screen.getByText('Default padding').parentElement;
    expect(container).toHaveClass('px-4');
    expect(container).not.toHaveClass('py-4');

    rerender(<Container px={false}>No horizontal padding</Container>);
    container = screen.getByText('No horizontal padding').parentElement;
    expect(container).not.toHaveClass('px-4');

    rerender(<Container py={true}>With vertical padding</Container>);
    container = screen.getByText('With vertical padding').parentElement;
    expect(container).toHaveClass('py-4');
  });

  it('combines custom classes with container classes', () => {
    render(<Container className="bg-gray-100">Custom container</Container>);
    const container = screen.getByText('Custom container').parentElement;
    expect(container).toHaveClass('bg-gray-100');
    expect(container).toHaveClass('max-w-screen-xl');
  });
});
