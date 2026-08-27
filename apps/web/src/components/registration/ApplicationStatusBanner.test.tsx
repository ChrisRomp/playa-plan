import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApplicationStatusBanner } from './ApplicationStatusBanner';

describe('ApplicationStatusBanner', () => {
  it('should show required registration actions for an approved application', () => {
    render(<ApplicationStatusBanner status="APPLICATION_APPROVED" />);

    expect(screen.getByText('Registration incomplete — action required')).toBeInTheDocument();
    expect(screen.getByText('Please complete your registration.')).toBeInTheDocument();
  });

  it.each(['APPLICATION_SUBMITTED', 'APPLICATION_DECLINED'])(
    'should not show incomplete registration actions for %s',
    (status) => {
      render(<ApplicationStatusBanner status={status} />);

      expect(
        screen.queryByText('Registration incomplete — action required'),
      ).not.toBeInTheDocument();
    },
  );
});
