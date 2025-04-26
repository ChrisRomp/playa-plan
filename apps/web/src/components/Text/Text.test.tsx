import { render, screen } from '@testing-library/react';
import { Text } from './Text';
import { describe, it, expect } from 'vitest';

describe('Text', () => {
  it('renders text with default variant', () => {
    render(<Text>Hello world</Text>);
    const textElement = screen.getByText('Hello world');
    expect(textElement).toBeInTheDocument();
    expect(textElement.tagName).toBe('P');
  });

  it('renders as different HTML elements based on variant', () => {
    const { rerender } = render(<Text variant="h1">Heading 1</Text>);
    expect(screen.getByText('Heading 1').tagName).toBe('H1');

    rerender(<Text variant="h2">Heading 2</Text>);
    expect(screen.getByText('Heading 2').tagName).toBe('H2');
    
    rerender(<Text variant="body">Body text</Text>);
    expect(screen.getByText('Body text').tagName).toBe('P');
    
    rerender(<Text variant="caption">Caption</Text>);
    expect(screen.getByText('Caption').tagName).toBe('SPAN');
  });

  it('uses the "as" prop to override the default element', () => {
    render(<Text as="div" variant="h1">Heading as div</Text>);
    expect(screen.getByText('Heading as div').tagName).toBe('DIV');
  });

  it('applies weight classes correctly', () => {
    render(<Text weight="bold">Bold text</Text>);
    expect(screen.getByText('Bold text')).toHaveClass('font-bold');
  });

  it('applies alignment classes correctly', () => {
    render(<Text align="center">Centered text</Text>);
    expect(screen.getByText('Centered text')).toHaveClass('text-center');
  });

  it('applies color classes', () => {
    render(<Text color="text-primary-500">Colored text</Text>);
    expect(screen.getByText('Colored text')).toHaveClass('text-primary-500');
  });

  it('combines all provided classes', () => {
    render(
      <Text 
        variant="h3" 
        weight="semibold" 
        align="right" 
        color="text-accent-600"
        className="custom-class"
      >
        Custom text
      </Text>
    );
    const element = screen.getByText('Custom text');
    expect(element).toHaveClass('text-2xl');
    expect(element).toHaveClass('font-semibold');
    expect(element).toHaveClass('text-right');
    expect(element).toHaveClass('text-accent-600');
    expect(element).toHaveClass('custom-class');
  });
});
