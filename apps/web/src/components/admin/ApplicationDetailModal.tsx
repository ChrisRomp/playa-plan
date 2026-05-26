import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ApplicationUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  playaName?: string | null;
}

interface ApplicationFieldDefinition {
  id: string;
  name?: string | null;
  label?: string | null;
  displayName?: string | null;
}

interface ApplicationFieldValue {
  id: string;
  value: unknown;
  field?: ApplicationFieldDefinition | null;
}

interface ApplicationCampingOptionRegistration {
  id: string;
  campingOption: {
    id: string;
    name: string;
    description?: string | null;
  };
  fieldValues?: ApplicationFieldValue[];
}

interface ApplicationDetail {
  id: string;
  userId: string;
  year: number;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  decisionMessage?: string | null;
  user: ApplicationUser;
  reviewedBy?: ApplicationUser | null;
  campingOptionRegistrations?: ApplicationCampingOptionRegistration[];
}

export interface ApplicationDetailModalProps {
  applicationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

function getStatusBadgeClass(status: string): string {
  if (status === 'APPLICATION_APPROVED') {
    return 'bg-green-100 text-green-800';
  }

  if (status === 'APPLICATION_DECLINED') {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-blue-100 text-blue-800';
}

function formatStatusLabel(status: string): string {
  return status
    .replace('APPLICATION_', '')
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_match, prefix: string, character: string) => `${prefix ? ' ' : ''}${character.toUpperCase()}`)
    .trim();
}

function formatDateTime(dateString?: string | null): string {
  if (!dateString) {
    return 'Not available';
  }

  return new Date(dateString).toLocaleString();
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getApplicantName(user?: ApplicationUser | null): string {
  if (!user) {
    return 'Unknown applicant';
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email;
}

export default function ApplicationDetailModal({
  applicationId,
  isOpen,
  onClose,
  onActionComplete,
}: ApplicationDetailModalProps) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState('');
  const [declineMessage, setDeclineMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'approve' | 'decline' | null>(null);

  useEffect(() => {
    if (!isOpen || !applicationId) {
      setApplication(null);
      setError(null);
      setApproveMessage('');
      setDeclineMessage('');
      setSubmitError(null);
      setSubmittingAction(null);
      return;
    }

    const fetchApplicationDetail = async () => {
      setLoading(true);
      setError(null);
      setSubmitError(null);

      try {
        const response = await api.get<ApplicationDetail>(`/admin/applications/${applicationId}`);
        setApplication(response.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load application detail.');
        setApplication(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchApplicationDetail();
  }, [applicationId, isOpen]);

  const customFieldCount = useMemo(() => {
    if (!application?.campingOptionRegistrations) {
      return 0;
    }

    return application.campingOptionRegistrations.reduce(
      (count, registration) => count + (registration.fieldValues?.length ?? 0),
      0,
    );
  }, [application]);

  if (!isOpen || !applicationId) {
    return null;
  }

  const handleApproveMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setApproveMessage(event.target.value);
  };

  const handleDeclineMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDeclineMessage(event.target.value);
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleApprove = async () => {
    if (!applicationId) {
      return;
    }

    setSubmittingAction('approve');
    setSubmitError(null);

    try {
      await api.patch(`/admin/applications/${applicationId}/approve`, {
        message: approveMessage.trim() || undefined,
      });
      onActionComplete();
      onClose();
    } catch (actionError) {
      setSubmitError(actionError instanceof Error ? actionError.message : 'Failed to approve application.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDecline = async () => {
    if (!applicationId) {
      return;
    }

    const trimmedMessage = declineMessage.trim();
    if (!trimmedMessage) {
      setSubmitError('A decline message is required.');
      return;
    }

    setSubmittingAction('decline');
    setSubmitError(null);

    try {
      await api.patch(`/admin/applications/${applicationId}/decline`, {
        message: trimmedMessage,
      });
      onActionComplete();
      onClose();
    } catch (actionError) {
      setSubmitError(actionError instanceof Error ? actionError.message : 'Failed to decline application.');
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 id="application-detail-title" className="text-xl font-semibold text-gray-900">
              Application Detail
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Review submitted application details and make a decision.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close application detail modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : !application ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Application detail is not available.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Applicant</h3>
                  <dl className="mt-3 space-y-2 text-sm text-gray-700">
                    <div>
                      <dt className="font-medium text-gray-900">Name</dt>
                      <dd>{getApplicantName(application.user)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Playa Name</dt>
                      <dd>{application.user.playaName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Email</dt>
                      <dd>{application.user.email}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Application</h3>
                  <dl className="mt-3 space-y-2 text-sm text-gray-700">
                    <div>
                      <dt className="font-medium text-gray-900">Status</dt>
                      <dd>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(application.status)}`}
                        >
                          {formatStatusLabel(application.status)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Application Date</dt>
                      <dd>{formatDateTime(application.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Year</dt>
                      <dd>{application.year}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Custom Field Responses</dt>
                      <dd>{customFieldCount}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-gray-900">Camping Options</h3>
                <div className="mt-3 space-y-3">
                  {application.campingOptionRegistrations && application.campingOptionRegistrations.length > 0 ? (
                    application.campingOptionRegistrations.map((registration) => (
                      <div key={registration.id} className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-base font-semibold text-gray-900">
                          {registration.campingOption.name}
                        </h4>
                        {registration.campingOption.description ? (
                          <p className="mt-1 text-sm text-gray-600">{registration.campingOption.description}</p>
                        ) : null}

                        <div className="mt-4">
                          <h5 className="text-sm font-medium text-gray-900">Custom Field Values</h5>
                          {registration.fieldValues && registration.fieldValues.length > 0 ? (
                            <dl className="mt-2 space-y-2 rounded-md bg-gray-50 p-3 text-sm">
                              {registration.fieldValues.map((fieldValue) => (
                                <div key={fieldValue.id} className="grid gap-1 md:grid-cols-[180px_1fr]">
                                  <dt className="font-medium text-gray-700">
                                    {fieldValue.field?.displayName || fieldValue.field?.label || fieldValue.field?.name || 'Field'}
                                  </dt>
                                  <dd className="text-gray-600">{formatFieldValue(fieldValue.value)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">No custom field responses were submitted.</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                      No camping options were included with this application.
                    </div>
                  )}
                </div>
              </section>

              {(application.reviewedAt || application.reviewedBy || application.decisionMessage) && (
                <section className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">Review Summary</h3>
                  <dl className="mt-3 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
                    <div>
                      <dt className="font-medium text-gray-900">Reviewed By</dt>
                      <dd>{getApplicantName(application.reviewedBy)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Reviewed At</dt>
                      <dd>{formatDateTime(application.reviewedAt)}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="font-medium text-gray-900">Decision Message</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-gray-600">
                        {application.decisionMessage || 'No decision message provided.'}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}

              {application.status === 'APPLICATION_SUBMITTED' && (
                <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Review Actions</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Add an optional approval note or include a required decline explanation.
                    </p>
                  </div>

                  {submitError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-green-200 bg-white p-4">
                      <label htmlFor="application-approve-message" className="block text-sm font-medium text-gray-700">
                        Approval Message (optional)
                      </label>
                      <textarea
                        id="application-approve-message"
                        rows={4}
                        value={approveMessage}
                        onChange={handleApproveMessageChange}
                        disabled={submittingAction !== null}
                        placeholder="Share any follow-up details for the applicant..."
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => void handleApprove()}
                        disabled={submittingAction !== null}
                        className="mt-3 inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submittingAction === 'approve' ? 'Approving...' : 'Approve Application'}
                      </button>
                    </div>

                    <div className="rounded-lg border border-red-200 bg-white p-4">
                      <label htmlFor="application-decline-message" className="block text-sm font-medium text-gray-700">
                        Decline Message (required)
                      </label>
                      <textarea
                        id="application-decline-message"
                        rows={4}
                        value={declineMessage}
                        onChange={handleDeclineMessageChange}
                        disabled={submittingAction !== null}
                        placeholder="Explain why this application cannot be approved right now..."
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDecline()}
                        disabled={submittingAction !== null}
                        className="mt-3 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submittingAction === 'decline' ? 'Declining...' : 'Decline Application'}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
