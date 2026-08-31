import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { CampingOptionRegistrationWithFields, Registration } from '../../lib/api';
import { REGISTRATION_REPORT_USER_PROFILE_FIELDS } from '../../pages/registrationReportFields';
import { formatRegistrationStatus } from '../../utils/registrationUtils';

interface RegistrationReportDetailModalProps {
  registration: Registration | null;
  campingOptionData: CampingOptionRegistrationWithFields[];
  showUserProfile: boolean;
  showRegistrationFields: boolean;
  registrationFieldsLoading: boolean;
  registrationFieldsError: string | null;
  onClose: () => void;
}

interface CampingOptionDetail {
  id: string;
  name: string;
  description: string | null;
  fields: Array<{
    id: string;
    displayName: string;
    order: number;
    value: string;
  }>;
}

function formatValue(value: string | null | undefined): string {
  return value && value.length > 0 ? value : '—';
}

function getUserName(registration: Registration): string {
  if (!registration.user) {
    return 'Unknown user';
  }

  const name = `${registration.user.firstName} ${registration.user.lastName}`.trim();
  return name || registration.user.email;
}

function getCampingOptionFields(
  detail: CampingOptionRegistrationWithFields | undefined
): CampingOptionDetail['fields'] {
  if (!detail) {
    return [];
  }

  const fieldValues = new Map(
    detail.fieldValues.map(fieldValue => [fieldValue.fieldId, fieldValue.value])
  );
  const fields = detail.campingOption.fields.map(field => ({
    id: field.id,
    displayName: field.displayName,
    order: field.order,
    value: fieldValues.get(field.id) ?? '',
  }));
  const definedFieldIds = new Set(fields.map(field => field.id));

  detail.fieldValues.forEach((fieldValue, index) => {
    if (!definedFieldIds.has(fieldValue.fieldId)) {
      fields.push({
        id: fieldValue.fieldId,
        displayName: fieldValue.field.displayName,
        order: Number.MAX_SAFE_INTEGER - detail.fieldValues.length + index,
        value: fieldValue.value,
      });
    }
  });

  return fields.sort((first, second) => {
    const orderDifference = first.order - second.order;
    return orderDifference !== 0
      ? orderDifference
      : first.displayName.localeCompare(second.displayName);
  });
}

function getCampingOptionDetails(
  registration: Registration | null,
  campingOptionData: CampingOptionRegistrationWithFields[]
): CampingOptionDetail[] {
  if (!registration) {
    return [];
  }

  const matchingDetails = campingOptionData.filter(
    detail => detail.registrationId === registration.id
  );
  const selectedOptions = registration.campingOptions ?? [];

  if (selectedOptions.length === 0) {
    return matchingDetails.map(detail => ({
      id: detail.id,
      name: detail.campingOption.name,
      description: detail.campingOption.description,
      fields: getCampingOptionFields(detail),
    }));
  }

  return selectedOptions.map(option => {
    const detail = matchingDetails.find(
      candidate => candidate.campingOptionId === option.campingOptionId
    );

    return {
      id: option.id,
      name: detail?.campingOption.name ?? option.campingOption?.name ?? 'Unknown option',
      description: detail?.campingOption.description ?? option.campingOption?.description ?? null,
      fields: getCampingOptionFields(detail),
    };
  });
}

export default function RegistrationReportDetailModal({
  registration,
  campingOptionData,
  showUserProfile,
  showRegistrationFields,
  registrationFieldsLoading,
  registrationFieldsError,
  onClose,
}: RegistrationReportDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const campingOptionDetails = useMemo(
    () => getCampingOptionDetails(registration, campingOptionData),
    [registration, campingOptionData]
  );

  useEffect(() => {
    if (!registration) {
      return;
    }

    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [registration, onClose]);

  if (!registration) {
    return null;
  }

  const userName = getUserName(registration);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-report-detail-title"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2
              id="registration-report-detail-title"
              className="text-xl font-semibold text-gray-900"
            >
              Registration Details
            </h2>
            <p className="mt-1 text-sm text-gray-600">{userName}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close registration details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="text-lg font-semibold text-gray-900">Registration</h3>
            <dl className="mt-3 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium text-gray-900">Name</dt>
                <dd className="mt-1 break-words text-gray-600">{userName}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Email</dt>
                <dd className="mt-1 break-words text-gray-600">
                  {formatValue(registration.user?.email)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Status</dt>
                <dd className="mt-1 text-gray-600">
                  {formatRegistrationStatus(registration.status)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Year</dt>
                <dd className="mt-1 text-gray-600">{registration.year}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Shift</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                  {registration.jobs.length > 0
                    ? registration.jobs.map(job => job.job.name).join(', ')
                    : 'No shifts assigned'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Registered</dt>
                <dd className="mt-1 text-gray-600">
                  {new Date(registration.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          {showUserProfile && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
              <dl className="mt-3 grid gap-4 rounded-lg border border-gray-200 p-4 text-sm md:grid-cols-2">
                {REGISTRATION_REPORT_USER_PROFILE_FIELDS.map(field => (
                  <div key={field.key}>
                    <dt className="font-medium text-gray-900">{field.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                      {formatValue(registration.user?.[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {showRegistrationFields && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900">Registration Fields</h3>
              <div className="mt-3 space-y-4">
                {registrationFieldsLoading ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    Loading registration fields...
                  </div>
                ) : registrationFieldsError ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    {registrationFieldsError}
                  </div>
                ) : campingOptionDetails.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                    No camping options were selected.
                  </div>
                ) : (
                  campingOptionDetails.map(option => (
                    <div
                      key={option.id}
                      className="rounded-lg border border-gray-200 p-4"
                      data-testid={`camping-option-detail-${option.id}`}
                    >
                      <h4 className="text-base font-semibold text-gray-900">{option.name}</h4>
                      {option.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                          {option.description}
                        </p>
                      )}
                      {option.fields.length > 0 ? (
                        <dl className="mt-4 space-y-3 rounded-md bg-gray-50 p-3 text-sm">
                          {option.fields.map(field => (
                            <div key={field.id} className="grid gap-1 md:grid-cols-[200px_1fr]">
                              <dt className="font-medium text-gray-700">{field.displayName}</dt>
                              <dd className="whitespace-pre-wrap break-words text-gray-600">
                                {formatValue(field.value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-3 text-sm text-gray-500">
                          No custom registration fields were defined.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
