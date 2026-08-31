import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ROUTES } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  DeleteUnverifiedUsersResult,
  UnverifiedUserCleanupCandidate,
  UnverifiedUserCleanupPage,
  UnverifiedUserCleanupSkipReason,
} from '../types/unverified-user-cleanup';

const PAGE_LIMIT = 100;

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
    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      if (typeof responseData.message === 'string') {
        return responseData.message;
      }
      if (Array.isArray(responseData.message)) {
        return responseData.message.join(', ');
      }
    }
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

function formatSkipReason(reason: UnverifiedUserCleanupSkipReason): string {
  const labels: Record<UnverifiedUserCleanupSkipReason, string> = {
    NOT_FOUND: 'account no longer exists',
    PROTECTED_ROLE: 'account is no longer a participant',
    ALREADY_VERIFIED: 'email was verified',
    TOO_NEW: 'account is not yet 30 days old',
    ACTIVE_LOGIN: 'account has an active login code',
    HAS_REGISTRATIONS: 'account has a registration',
    HAS_PASSKEYS: 'account has a passkey',
    HAS_RELATED_ACTIVITY: 'account has protected related activity',
  };

  return labels[reason];
}

function getDisplayName(user: UnverifiedUserCleanupCandidate): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

/**
 * Admin utility for permanently removing stale unverified participant accounts.
 */
export default function AdminUnverifiedUserCleanupPage() {
  const [candidatePage, setCandidatePage] = useState<UnverifiedUserCleanupPage | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);

  const fetchCandidates = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<UnverifiedUserCleanupPage>('/admin/users/unverified-cleanup', {
        params: {
          page,
          limit: PAGE_LIMIT,
        },
      });
      if (response.data.page > response.data.totalPages) {
        setCandidatePage(null);
        setSelectedIds([]);
        setPage(response.data.totalPages);
        return;
      }

      setCandidatePage(response.data);
      setSelectedIds([]);
    } catch (fetchError) {
      setCandidatePage(null);
      setSelectedIds([]);
      setError(getErrorMessage(fetchError, 'Unable to load unused accounts.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (isConfirmOpen) {
      cancelButtonRef.current?.focus();
      return;
    }

    if (shouldRestoreFocusRef.current) {
      removeButtonRef.current?.focus();
      shouldRestoreFocusRef.current = false;
    }
  }, [isConfirmOpen]);

  const users = useMemo(() => candidatePage?.users ?? [], [candidatePage]);
  const selectedUsers = useMemo(
    () => users.filter(user => selectedIds.includes(user.id)),
    [selectedIds, users]
  );
  const allSelected = users.length > 0 && users.every(user => selectedIds.includes(user.id));

  const handleSelectAll = (): void => {
    setSelectedIds(allSelected ? [] : users.map(user => user.id));
  };

  const handleSelectUser = (userId: string): void => {
    setSelectedIds(currentIds =>
      currentIds.includes(userId) ? currentIds.filter(id => id !== userId) : [...currentIds, userId]
    );
  };

  const closeConfirmDialog = (): void => {
    shouldRestoreFocusRef.current = true;
    setIsConfirmOpen(false);
  };

  const handleConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && !deleting) {
      event.preventDefault();
      closeConfirmDialog();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      confirmDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (selectedIds.length === 0) {
      return;
    }

    setDeleting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await api.post<DeleteUnverifiedUsersResult>(
        '/admin/users/unverified-cleanup/delete',
        { ids: selectedIds }
      );
      const deletedCount = response.data.deleted.length;
      const skippedSummary = response.data.skipped
        .map(skipped => formatSkipReason(skipped.reason))
        .join(', ');
      setFeedback(
        response.data.skipped.length > 0
          ? `${deletedCount} account${deletedCount === 1 ? '' : 's'} permanently removed. ` +
              `${response.data.skipped.length} skipped: ${skippedSummary}.`
          : `${deletedCount} account${deletedCount === 1 ? '' : 's'} permanently removed.`
      );
      setIsConfirmOpen(false);
      setSelectedIds([]);
      await fetchCandidates();
    } catch (deleteError) {
      closeConfirmDialog();
      setError(getErrorMessage(deleteError, 'Unable to remove the selected accounts.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unverified Email Cleanup</h1>
          <p className="mt-1 text-sm text-gray-600">
            Permanently remove unused participant accounts that have been unverified for at least{' '}
            {candidatePage?.minimumAgeDays ?? 30} days.
          </p>
        </div>
        <Link
          to={ROUTES.ADMIN.path}
          className="self-start rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
        >
          Back to Admin
        </Link>
      </div>

      {feedback ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchCandidates()}
            className="mt-2 font-medium text-red-700 underline"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-red-900">
            {selectedIds.length} account{selectedIds.length === 1 ? '' : 's'} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              ref={removeButtonRef}
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Permanently Remove
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 transition hover:bg-red-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-white shadow">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      disabled={users.length === 0}
                      aria-label="Select all unused accounts on this page"
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Account Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                      No unused unverified accounts are eligible for cleanup.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          aria-label={`Select ${getDisplayName(user)}`}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {getDisplayName(user)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && candidatePage ? (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-600">
              Page {candidatePage.page} of {candidatePage.totalPages} ({candidatePage.total}{' '}
              eligible)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(currentPage => currentPage - 1)}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(currentPage => currentPage + 1)}
                disabled={page >= candidatePage.totalPages}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cleanup-confirm-title"
            onKeyDown={handleConfirmKeyDown}
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="cleanup-confirm-title" className="text-lg font-semibold text-gray-900">
              Permanently remove {selectedIds.length} unused account
              {selectedIds.length === 1 ? '' : 's'}?
            </h2>
            <p className="mt-2 text-sm font-medium text-red-700">
              This operation cannot be undone.
            </p>
            <ul className="mt-4 max-h-48 list-disc overflow-y-auto pl-5 text-sm text-gray-700">
              {selectedUsers.map(user => (
                <li key={user.id}>{user.email}</li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeConfirmDialog}
                disabled={deleting}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Removing...' : 'Permanently Remove'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
