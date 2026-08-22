import { AlertCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  reports,
  ScheduleExceptionJob,
  ScheduleExceptionShift,
  ScheduleExceptionsReportData,
} from '../lib/api';
import { PATHS } from '../routes';

function formatDay(dayOfWeek: string): string {
  return dayOfWeek
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatShift(shift: ScheduleExceptionShift): string {
  return `${shift.name} (${formatDay(shift.dayOfWeek)}, ${shift.startTime}-${shift.endTime})`;
}

function formatJob(job: ScheduleExceptionJob): string {
  return `${job.name} - ${formatShift(job.shift)}`;
}

/** Staff/admin view of confirmed registrations with work-schedule exceptions. */
export function ScheduleExceptionsReportPage() {
  const [report, setReport] = useState<ScheduleExceptionsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    reports
      .getScheduleExceptions()
      .then(data => {
        if (active) {
          setReport(data);
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load schedule exceptions. Please try again.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          to={PATHS.REPORTS}
          className="mb-4 inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-800"
        >
          <ArrowLeft size={16} />
          Back to Reports
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">
          Schedule Exceptions Report
        </h1>
        <p className="mt-2 text-gray-600">
          Confirmed registrations with extra or conflicting work shifts
          {report ? ` for ${report.year}` : ''}.
        </p>

        {!report && !error && (
          <div className="flex items-center justify-center py-16 text-gray-600">
            <Loader2 className="mr-2 animate-spin" size={24} />
            Loading schedule exceptions...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-8 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {report?.exceptions.length === 0 && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <h2 className="text-lg font-semibold text-green-900">
              No schedule exceptions
            </h2>
            <p className="mt-1 text-green-800">
              No confirmed {report.year} registrations have extra or conflicting
              shifts.
            </p>
          </div>
        )}

        {report && report.exceptions.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table
              className="min-w-full divide-y divide-gray-200"
              aria-label="Schedule exceptions report"
            >
              <thead className="bg-gray-50">
                <tr>
                  {['Participant', 'Exceptions', 'Shift count', 'Assigned shifts', 'Conflicts'].map(
                    heading => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.exceptions.map(exception => (
                  <tr key={exception.registrationId} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {exception.user.firstName} {exception.user.lastName}
                      </div>
                      {exception.user.playaName && (
                        <div className="text-sm text-gray-600">
                          {exception.user.playaName}
                        </div>
                      )}
                      <div className="text-sm text-gray-500">
                        {exception.user.email}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {exception.extraCount > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                            {exception.extraCount} extra
                          </span>
                        )}
                        {exception.conflicts.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-900">
                            <AlertTriangle size={12} />
                            {exception.conflicts.length} conflict
                            {exception.conflicts.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {exception.selectedCount} selected / {exception.requiredCount}{' '}
                      required
                    </td>
                    <td className="px-4 py-4">
                      <ul className="space-y-2 text-sm text-gray-700">
                        {exception.jobs.map(job => (
                          <li key={job.id}>
                            <span className="font-medium">{job.categoryName}:</span>{' '}
                            {formatJob(job)}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-4">
                      {exception.conflicts.length === 0 ? (
                        <span className="text-sm text-gray-500">None</span>
                      ) : (
                        <ul className="space-y-2 text-sm text-red-800">
                          {exception.conflicts.map(conflict => (
                            <li
                              key={`${conflict.firstJob.id}-${conflict.secondJob.id}`}
                              aria-label={`${conflict.firstJob.name} conflicts with ${conflict.secondJob.name}`}
                            >
                              <span className="font-medium">
                                {conflict.firstJob.name}
                              </span>{' '}
                              conflicts with{' '}
                              <span className="font-medium">
                                {conflict.secondJob.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
