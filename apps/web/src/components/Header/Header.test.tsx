import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Header } from './Header';

describe('Header Component', () => {
  it('renders logo correctly', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText('PlayaPlan')).toBeInTheDocument();
  });

  it('renders custom logo when provided', () => {
    render(
      <MemoryRouter>
        <Header logo={<span data-testid="custom-logo">Custom Logo</span>} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
    expect(screen.getByText('Custom Logo')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    const navItems = [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ];
    
    render(
      <MemoryRouter>
        <Header navItems={navItems} />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('renders external links with proper attributes', () => {
    const navItems = [
      { label: 'GitHub', href: 'https://github.com', isExternal: true },
    ];
    
    render(
      <MemoryRouter>
        <Header navItems={navItems} />
      </MemoryRouter>
    );
    
    const externalLink = screen.getByText('GitHub');
    expect(externalLink).toBeInTheDocument();
    expect(externalLink.tagName).toBe('A');
    expect(externalLink).toHaveAttribute('href', 'https://github.com');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders right section content', () => {
    render(
      <MemoryRouter>
        <Header rightSection={<button>Login</button>} />
      </MemoryRouter>
    );
    
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('toggles mobile menu when menu button is clicked', () => {
    render(
      <MemoryRouter>
        <Header 
          navItems={[{ label: 'Mobile Item', href: '/mobile' }]}
        />
      </MemoryRouter>
    );
    
    // Mobile menu should be initially hidden
    expect(screen.queryByText('Mobile Item')).not.toBeVisible();
    
    // Open the menu
    fireEvent.click(screen.getByRole('button', { name: 'Open main menu' }));
    
    // Now the mobile item should be visible
    expect(screen.getByText('Mobile Item')).toBeVisible();
  });
});
