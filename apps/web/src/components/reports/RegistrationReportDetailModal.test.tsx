import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampingOptionRegistrationWithFields, Registration } from '../../lib/api';
import RegistrationReportDetailModal from './RegistrationReportDetailModal';

const mockRegistration: Registration = {
  id: 'registration-1',
  userId: 'user-1',
  year: 2026,
  status: 'CONFIRMED',
  createdAt: '2026-02-01T12:00:00.000Z',
  updatedAt: '2026-02-02T12:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Camper',
    playaName: 'Dusty',
    role: 'PARTICIPANT',
    phone: '555-0100',
    emergencyContact: 'Morgan, 555-0199',
    city: 'Oakland',
    stateProvince: 'CA',
    country: 'USA',
    isEmailVerified: true,
    createdAt: '2025-01-01T12:00:00.000Z',
    updatedAt: '2025-01-01T12:00:00.000Z',
  },
  jobs: [
    {
      id: 'registration-job-1',
      registrationId: 'registration-1',
      jobId: 'job-1',
      createdAt: '2026-02-01T12:00:00.000Z',
      job: {
        id: 'job-1',
        name: 'Gate',
        location: 'Entrance',
        categoryId: 'category-1',
        shiftId: 'shift-1',
        maxRegistrations: 10,
        category: {
          id: 'category-1',
          name: 'Operations',
          description: 'Camp operations',
        },
      },
    },
  ],
  payments: [],
  campingOptions: [
    {
      id: 'selected-option-1',
      userId: 'user-1',
      campingOptionId: 'option-1',
      createdAt: '2026-02-01T12:00:00.000Z',
      updatedAt: '2026-02-01T12:00:00.000Z',
    },
    {
      id: 'selected-option-2',
      userId: 'user-1',
      campingOptionId: 'option-2',
      createdAt: '2026-02-01T12:00:00.000Z',
      updatedAt: '2026-02-01T12:00:00.000Z',
    },
  ],
};

const mockCampingOptionData: CampingOptionRegistrationWithFields[] = [
  {
    id: 'detail-option-1',
    registrationId: 'registration-1',
    userId: 'user-1',
    campingOptionId: 'option-1',
    user: {
      id: 'user-1',
      email: 'alex@example.com',
      firstName: 'Alex',
      lastName: 'Camper',
      playaName: 'Dusty',
    },
    campingOption: {
      id: 'option-1',
      name: 'Tent Camping',
      description: 'Bring your own tent.',
      enabled: true,
      fields: [
        {
          id: 'field-1',
          displayName: 'Camp Setup',
          dataType: 'MULTILINE_STRING',
          required: true,
          order: 0,
        },
        {
          id: 'field-blank',
          displayName: 'Radio Call Sign',
          dataType: 'STRING',
          required: false,
          order: 1,
        },
      ],
    },
    fieldValues: [
      {
        id: 'value-1',
        value: 'A long response with enough detail to wrap.\nSecond line of the response.',
        fieldId: 'field-1',
        registrationId: 'detail-option-1',
        field: {
          id: 'field-1',
          displayName: 'Camp Setup',
          dataType: 'MULTILINE_STRING',
          required: true,
        },
        createdAt: '2026-02-01T12:00:00.000Z',
        updatedAt: '2026-02-01T12:00:00.000Z',
      },
    ],
    createdAt: '2026-02-01T12:00:00.000Z',
    updatedAt: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 'detail-option-2',
    registrationId: 'registration-1',
    userId: 'user-1',
    campingOptionId: 'option-2',
    user: {
      id: 'user-1',
      email: 'alex@example.com',
      firstName: 'Alex',
      lastName: 'Camper',
      playaName: 'Dusty',
    },
    campingOption: {
      id: 'option-2',
      name: 'Vehicle Camping',
      description: null,
      enabled: true,
      fields: [
        {
          id: 'field-2',
          displayName: 'Vehicle Length',
          dataType: 'STRING',
          required: true,
          order: 0,
        },
      ],
    },
    fieldValues: [
      {
        id: 'value-2',
        value: '24 feet',
        fieldId: 'field-2',
        registrationId: 'detail-option-2',
        field: {
          id: 'field-2',
          displayName: 'Vehicle Length',
          dataType: 'STRING',
          required: true,
        },
        createdAt: '2026-02-01T12:00:00.000Z',
        updatedAt: '2026-02-01T12:00:00.000Z',
      },
    ],
    createdAt: '2026-02-01T12:00:00.000Z',
    updatedAt: '2026-02-01T12:00:00.000Z',
  },
];

function renderModal(overrides: Partial<Parameters<typeof RegistrationReportDetailModal>[0]> = {}) {
  const props = {
    registration: mockRegistration,
    campingOptionData: mockCampingOptionData,
    showUserProfile: false,
    showRegistrationFields: false,
    registrationFieldsLoading: false,
    registrationFieldsError: null,
    onClose: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<RegistrationReportDetailModal {...props} />),
    props,
  };
}

describe('RegistrationReportDetailModal', () => {
  it('should render core registration data while respecting disabled report toggles', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Registration Details' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Gate')).toBeInTheDocument();
    expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration Fields')).not.toBeInTheDocument();
  });

  it('should render profile fields and group dynamic responses by selected camping option', () => {
    renderModal({
      showUserProfile: true,
      showRegistrationFields: true,
    });

    expect(screen.getByText('User Profile')).toBeInTheDocument();
    expect(screen.getByText('Dusty')).toBeInTheDocument();
    expect(screen.getByText('Morgan, 555-0199')).toBeInTheDocument();

    const tentOption = screen.getByTestId('camping-option-detail-selected-option-1');
    const vehicleOption = screen.getByTestId('camping-option-detail-selected-option-2');

    expect(within(tentOption).getByText('Camp Setup')).toBeInTheDocument();
    expect(within(tentOption).getByText(/Second line of the response/)).toBeInTheDocument();
    expect(within(tentOption).getByText('Radio Call Sign')).toBeInTheDocument();
    expect(within(tentOption).getByText('—')).toBeInTheDocument();
    expect(within(tentOption).queryByText('Vehicle Length')).not.toBeInTheDocument();

    expect(within(vehicleOption).getByText('Vehicle Length')).toBeInTheDocument();
    expect(within(vehicleOption).getByText('24 feet')).toBeInTheDocument();
    expect(within(vehicleOption).queryByText('Camp Setup')).not.toBeInTheDocument();
  });

  it('should close from the close button and Escape key', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close registration details' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should trap forward and reverse focus and make background content inert', () => {
    const { rerender } = render(
      <>
        <button type="button">Background action</button>
        <RegistrationReportDetailModal
          registration={mockRegistration}
          campingOptionData={mockCampingOptionData}
          showUserProfile={false}
          showRegistrationFields={false}
          registrationFieldsLoading={false}
          registrationFieldsError={null}
          onClose={vi.fn()}
        />
      </>
    );
    const backgroundButton = screen.getByRole('button', { name: 'Background action' });
    const closeButton = screen.getByRole('button', { name: 'Close registration details' });

    expect(backgroundButton).toHaveAttribute('inert');
    expect(closeButton).toHaveFocus();

    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(closeButton).toHaveFocus();

    expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(closeButton).toHaveFocus();

    rerender(<button type="button">Background action</button>);

    expect(screen.getByRole('button', { name: 'Background action' })).not.toHaveAttribute('inert');
  });
});
