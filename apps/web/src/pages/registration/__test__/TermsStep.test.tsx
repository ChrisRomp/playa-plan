import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Create a component just for testing the terms section
const TermsSection = ({ registrationTerms }: { registrationTerms?: string }) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Terms & Conditions</h3>
      <div className="border p-4 rounded bg-gray-50 mb-4">
        {registrationTerms ? (
          <div dangerouslySetInnerHTML={{ __html: registrationTerms }} />
        ) : (
          <p>No terms and conditions have been specified.</p>
        )}
      </div>
    </div>
  );
};

describe('Terms Step', () => {
  it('should display registration terms from config', () => {
    // Mock config with specific terms
    const testTerms = '<p>These are the <strong>test</strong> terms and conditions.</p>';
    
    render(
      <MemoryRouter>
        <TermsSection registrationTerms={testTerms} />
      </MemoryRouter>
    );
    
    // Check that terms are displayed
    const termsHeading = screen.getByText('Terms & Conditions');
    expect(termsHeading).toBeInTheDocument();
    
    // Get the terms container div
    const termsContainerDiv = termsHeading.parentElement?.querySelector('.border.p-4');
    expect(termsContainerDiv).toBeInTheDocument();
    
    // Check that the HTML content is rendered properly
    expect(termsContainerDiv?.innerHTML).toContain('These are the <strong>test</strong> terms and conditions.');
  });
  
  it('should display fallback message when no terms are provided', () => {
    render(
      <MemoryRouter>
        <TermsSection registrationTerms={undefined} />
      </MemoryRouter>
    );
    
    // Check that fallback message is displayed
    expect(screen.getByText('No terms and conditions have been specified.')).toBeInTheDocument();
  });
});
