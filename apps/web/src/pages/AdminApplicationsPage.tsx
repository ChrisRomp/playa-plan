import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ROUTES } from '../routes';
import ApplicationDetailModal from '../components/admin/ApplicationDetailModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../store/authUtils';
import { ROLES } from '../types/auth';

interface Application {
  id: string;
  userId: string;
  year: number;
  status: string;
  reviewedAt?: string | null;
  decisionMessage?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string | null;
  };
  campingOptionRegistrations?: Array<{
    id: string;
    campingOption: { id: string; name: string };
  }>;
}

interface ApplicationListResponse {
  data: Application[];
  total: number;
  page: number;
  limit: number;
}

type StatusFilter = 'ALL' | 'APPLICATION_SUBMITTED' | 'APPLICATION_APPROVED' | 'APPLICATION_DECLINED';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

type DeclineDialogState = {
  ids: string[];
  label: string;
} | null;

const PAGE_SIZE = 10;
const DEFAULT_STATUS_FILTER: StatusFilter = 'APPLICATION_SUBMITTED';

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

function getApplicantName(application: Application): string {
  const fullName = [application.user?.firstName, application.user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || application.user?.email || 'Unknown applicant';
}

function getCampingOptions(application: Application): string {
  const campingOptions = application.campingOptionRegistrations?.map((registration) => registration.campingOption.name) ?? [];
  return campingOptions.length > 0 ? campingOptions.join(', ') : 'No camping options';
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const responseData = error.response.data;

    if (
      responseData &&
      typeof responseData === 'object' &&
      'message' in responseData &&
      typeof responseData.message === 'string'
    ) {
      return responseData.message;
    }

    if (
      responseData &&
      typeof responseData === 'object' &&
      'message' in responseData &&
      Array.isArray(responseData.message)
    ) {
      return responseData.message.join(', ');
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export default function AdminApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<FeedbackMessage>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS_FILTER);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [declineDialog, setDeclineDialog] = useState<DeclineDialogState>(null);
  const [declineMessage, setDeclineMessage] = useState('');
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const backPath = user?.role === ROLES.ADMIN ? ROUTES.ADMIN.path : ROUTES.REPORTS.path;
  const backLabel = user?.role === ROLES.ADMIN ? 'Back to Admin' : 'Back to Reports';

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApplicationListResponse>('/admin/applications', {
        params: {
          page,
          limit,
          search: searchTerm.trim() || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        },
      });

      setApplications(response.data.data);
      setTotal(response.data.total);
      setLimit(response.data.limit);
    } catch (fetchError) {
      setApplications([]);
      setTotal(0);
      setError(getErrorMessage(fetchError, 'Failed to load applications.'));
    } finally {
      setLoading(false);
    }
  }, [limit, page, searchTerm, statusFilter]);

  const refreshApplications = useCallback(async () => {
    setSelectedIds([]);
    await fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    setSelectedIds((currentSelectedIds) => {
      const reviewableIds = new Set(
        applications
          .filter((application) => application.status === 'APPLICATION_SUBMITTED')
          .map((application) => application.id),
      );

      return currentSelectedIds.filter((id) => reviewableIds.has(id));
    });
  }, [applications]);

  const reviewableIds = useMemo(
    () =>
      applications
        .filter((application) => application.status === 'APPLICATION_SUBMITTED')
        .map((application) => application.id),
    [applications],
  );

  const allSelected = reviewableIds.length > 0 && reviewableIds.every((id) => selectedIds.includes(id));
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const isDeclineSubmitting = rowActionId !== null || bulkSubmitting;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handleStatusFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value as StatusFilter);
    setPage(1);
  };

  const handleSelectAllChange = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(reviewableIds);
  };

  const handleRowSelection = (applicationId: string) => {
    setSelectedIds((currentSelectedIds) =>
      currentSelectedIds.includes(applicationId)
        ? currentSelectedIds.filter((id) => id !== applicationId)
        : [...currentSelectedIds, applicationId],
    );
  };

  const handleApprove = async (applicationId: string) => {
    setRowActionId(applicationId);
    setFeedbackMessage(null);

    try {
      await api.patch(`/admin/applications/${applicationId}/approve`, {});
      setFeedbackMessage({ type: 'success', message: 'Application approved.' });
      await refreshApplications();
    } catch (actionError) {
      setFeedbackMessage({
        type: 'error',
        message: getErrorMessage(actionError, 'Failed to approve application.'),
      });
    } finally {
      setRowActionId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    setBulkSubmitting(true);
    setFeedbackMessage(null);

    try {
      await api.patch('/admin/applications/bulk', {
        ids: selectedIds,
        action: 'approve',
      });
      setFeedbackMessage({
        type: 'success',
        message: `${selectedIds.length} application${selectedIds.length === 1 ? '' : 's'} approved.`,
      });
      await refreshApplications();
    } catch (actionError) {
      setFeedbackMessage({
        type: 'error',
        message: getErrorMessage(actionError, 'Failed to approve selected applications.'),
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openDeclineDialog = (ids: string[], label: string) => {
    setDeclineDialog({ ids, label });
    setDeclineMessage('');
    setDeclineError(null);
  };

  const closeDeclineDialog = () => {
    setDeclineDialog(null);
    setDeclineMessage('');
    setDeclineError(null);
  };

  const handleDeclineSubmit = async () => {
    if (!declineDialog) {
      return;
    }

    const trimmedMessage = declineMessage.trim();
    if (!trimmedMessage) {
      setDeclineError('A decline message is required.');
      return;
    }

    const isBulkAction = declineDialog.ids.length > 1;
    setFeedbackMessage(null);

    if (isBulkAction) {
      setBulkSubmitting(true);
    } else {
      setRowActionId(declineDialog.ids[0]);
    }

    try {
      if (isBulkAction) {
        await api.patch('/admin/applications/bulk', {
          ids: declineDialog.ids,
          action: 'decline',
          message: trimmedMessage,
        });
      } else {
        await api.patch(`/admin/applications/${declineDialog.ids[0]}/decline`, {
          message: trimmedMessage,
        });
      }

      setFeedbackMessage({
        type: 'success',
        message: isBulkAction
          ? `${declineDialog.ids.length} applications declined.`
          : 'Application declined.',
      });
      closeDeclineDialog();
      await refreshApplications();
    } catch (actionError) {
      setDeclineError(getErrorMessage(actionError, 'Failed to decline application.'));
    } finally {
      setRowActionId(null);
      setBulkSubmitting(false);
    }
  };

  const handleRowClick = (applicationId: string) => {
    setSelectedApplicationId(applicationId);
  };

  const handleCheckboxClick = (event: MouseEvent<HTMLButtonElement | HTMLInputElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review and manage submitted registration applications.
          </p>
        </div>
        <Link
          to={backPath}
          className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
        >
          {backLabel}
        </Link>
      </div>

      {feedbackMessage ? (
        <div
          className={`mb-4 rounded-md border p-4 text-sm ${
            feedbackMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedbackMessage.message}
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-amber-900">
            {selectedIds.length} application{selectedIds.length === 1 ? '' : 's'} selected
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleBulkApprove()}
              disabled={bulkSubmitting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkSubmitting ? 'Processing...' : 'Bulk Approve'}
            </button>
            <button
              type="button"
              onClick={() => openDeclineDialog(selectedIds, `${selectedIds.length} selected application${selectedIds.length === 1 ? '' : 's'}`)}
              disabled={bulkSubmitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Bulk Decline
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl bg-white shadow">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <label htmlFor="application-search" className="sr-only">
              Search applications
            </label>
            <input
              id="application-search"
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by applicant name or email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="w-full lg:w-64">
            <label htmlFor="application-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="application-status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All</option>
              <option value="APPLICATION_SUBMITTED">Submitted</option>
              <option value="APPLICATION_APPROVED">Approved</option>
              <option value="APPLICATION_DECLINED">Declined</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllChange}
                      disabled={reviewableIds.length === 0}
                      aria-label="Select all applications"
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Playa Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Camping Option(s)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  applications.map((application, index) => {
                    const isReviewable = application.status === 'APPLICATION_SUBMITTED';
                    const isProcessingRow = rowActionId === application.id;

                    return (
                      <tr
                        key={application.id}
                        onClick={() => handleRowClick(application.id)}
                        className={`cursor-pointer transition hover:bg-amber-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}`}
                      >
                        <td className="px-4 py-4" onClick={handleCheckboxClick}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(application.id)}
                            onChange={() => handleRowSelection(application.id)}
                            disabled={!isReviewable || bulkSubmitting}
                            aria-label={`Select ${getApplicantName(application)}`}
                            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{getApplicantName(application)}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{application.user?.playaName || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{application.user?.email || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{getCampingOptions(application)}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{formatDate(application.createdAt)}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(application.status)}`}
                          >
                            {formatStatusLabel(application.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm" onClick={handleCheckboxClick}>
                          {isReviewable ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApprove(application.id)}
                                disabled={isProcessingRow || bulkSubmitting}
                                className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isProcessingRow ? 'Working...' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openDeclineDialog(
                                    [application.id],
                                    getApplicantName(application),
                                  )
                                }
                                disabled={isProcessingRow || bulkSubmitting}
                                className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {total === 0
              ? 'Showing 0 applications'
              : `Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1 || loading}
              className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ApplicationDetailModal
        applicationId={selectedApplicationId}
        isOpen={selectedApplicationId !== null}
        onClose={() => setSelectedApplicationId(null)}
        onActionComplete={() => {
          void refreshApplications();
        }}
      />

      {declineDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-applications-title"
          >
            <div className="border-b px-6 py-4">
              <h2 id="decline-applications-title" className="text-lg font-semibold text-gray-900">
                Decline Application{declineDialog.ids.length === 1 ? '' : 's'}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Provide a message for {declineDialog.label}.
                {' '}This message is sent to the applicant by email.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="decline-applications-message" className="block text-sm font-medium text-gray-700">
                  Decline message
                </label>
                <textarea
                  id="decline-applications-message"
                  rows={5}
                  value={declineMessage}
                  onChange={(event) => {
                    setDeclineMessage(event.target.value);
                    if (declineError) {
                      setDeclineError(null);
                    }
                  }}
                  disabled={isDeclineSubmitting}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Explain why this application cannot be approved..."
                />
              </div>
              {declineError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {declineError}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={closeDeclineDialog}
                disabled={isDeclineSubmitting}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeclineSubmit()}
                disabled={isDeclineSubmitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeclineSubmitting
                  ? 'Declining...'
                  : `Decline Application${declineDialog.ids.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
