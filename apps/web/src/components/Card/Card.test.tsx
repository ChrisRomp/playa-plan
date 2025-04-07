import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './Card';

describe('Card Component', () => {
  it('should render children correctly', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('should render with a title', () => {
    render(<Card title="Card Title">Card Content</Card>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('should render with a footer', () => {
    render(
      <Card footer={<div>Footer Content</div>}>
        Card Content
      </Card>
    );
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('should apply border styles when bordered is true', () => {
    render(<Card bordered>Card Content</Card>);
    // The first div should be the card container
    const card = screen.getByText('Card Content').closest('div[class*="border"]');
    expect(card).toHaveClass('border');
  });

  it('should not apply border styles when bordered is false', () => {
    render(<Card bordered={false}>Card Content</Card>);
    // The parent div should not have border class
    const card = screen.getByText('Card Content').closest('div[class*="bg-white"]');
    expect(card).not.toHaveClass('border');
  });

  it('should apply hover styles when hoverable is true', () => {
    render(<Card hoverable>Card Content</Card>);
    const card = screen.getByText('Card Content').closest('div[class*="bg-white"]');
    expect(card).toHaveClass('hover:shadow-lg');
  });

  it('should render a loading state', () => {
    render(<Card loading>Card Content</Card>);
    // When loading, content should not be visible
    expect(screen.queryByText('Card Content')).not.toBeInTheDocument();
    // Should show a loading spinner (div with animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should render title icon when provided', () => {
    render(
      <Card 
        title="Card With Icon" 
        titleIcon={<span data-testid="title-icon">🔍</span>}
      >
        Card Content
      </Card>
    );
    expect(screen.getByTestId('title-icon')).toBeInTheDocument();
  });
}); 