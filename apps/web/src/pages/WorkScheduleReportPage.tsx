import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Download, Filter, X, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { reports } from '../lib/api';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { downloadCsv } from '../utils/csv';
import { downloadFile } from '../utils/downloadFile';
import { getTimeInMinutes } from '../utils/shiftUtils';

// Day of week values from backend for sorting
// (removed enum definition to simplify type handling)

// Type definitions for the work schedule data
interface WorkScheduleUser {
  id: string;
  firstName: string;
  lastName: string;
  playaName: string | null;
}

interface WorkScheduleRegistration {
  id: string;
  user: WorkScheduleUser;
}

interface WorkScheduleJob {
  id: string;
  name: string;
  location: string;
  maxRegistrations: number;
  staffOnly: boolean;
  categoryId: string;
  category: { id: string; name: string };
  registrations: WorkScheduleRegistration[];
}

interface WorkScheduleShift {
  id: string;
  name: string;
  dayOfWeek: string;  // Changed from keyof typeof DayOfWeek to string to match API response
  startTime: string; 
  endTime: string;
  jobs: WorkScheduleJob[];
}

interface WorkScheduleData {
  shifts: WorkScheduleShift[];
}

interface DayGroupedShifts {
  [key: string]: WorkScheduleShift[];
}

/**
 * Work Schedule Report page
 * Displays all shifts with their jobs and user signups
 */
export function WorkScheduleReportPage() {
  const [workScheduleData, setWorkScheduleData] = useState<WorkScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [includeStaffOnly, setIncludeStaffOnly] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Define the order for days of the week
  const dayOrder = useMemo(() => [
    'PRE_OPENING',
    'OPENING_SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'CLOSING_SUNDAY',
    'POST_EVENT'
  ], []);

  // Human-readable day names
  const dayNames: Record<string, string> = useMemo(() => ({
    PRE_OPENING: 'Pre-Opening',
    OPENING_SUNDAY: 'Opening Sunday',
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    CLOSING_SUNDAY: 'Closing Sunday',
    POST_EVENT: 'Post-Event'
  }), []);

  const fetchWorkSchedule = useCallback(async (): Promise<void> => {
    setLoading(true);
    setScheduleError(null);
    try {
      const data = await reports.getWorkSchedule();
      setWorkScheduleData(data);
    } catch (err) {
      setScheduleError('Failed to fetch work schedule data');
      console.error('Error fetching work schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch work schedule data
  useEffect(() => {
    void fetchWorkSchedule();
  }, [fetchWorkSchedule]);

  // Group shifts by day of week
  const shiftsByDay = useMemo(() => {
    if (!workScheduleData) return {};

    return workScheduleData.shifts.reduce<DayGroupedShifts>((acc, shift) => {
      const day = shift.dayOfWeek;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(shift);
      return acc;
    }, {});
  }, [workScheduleData]);

  // Get all days that have shifts
  const availableDays = useMemo(() => {
    if (!workScheduleData) return [];
    
    const days = [...new Set(workScheduleData.shifts.map(shift => shift.dayOfWeek))];
    // Sort by the predefined day order
    return days.sort(
      (a, b) => {
        // Handle cases where the enum might not match
        const indexA = dayOrder.indexOf(a) !== -1 ? dayOrder.indexOf(a) : 999;
        const indexB = dayOrder.indexOf(b) !== -1 ? dayOrder.indexOf(b) : 999;
        return indexA - indexB;
      }
    );
  }, [workScheduleData, dayOrder]);

  // Filter shifts by selected day and job visibility
  const filteredShiftsByDay = useMemo(() => {
    const selectedDays =
      dayFilter === 'all'
        ? shiftsByDay
        : shiftsByDay[dayFilter]
          ? { [dayFilter]: shiftsByDay[dayFilter] }
          : {};

    if (includeStaffOnly) {
      return selectedDays;
    }

    return Object.fromEntries(
      Object.entries(selectedDays)
        .map(([day, shifts]) => [
          day,
          shifts
            .map(shift => ({
              ...shift,
              jobs: shift.jobs.filter(job => !job.staffOnly),
            }))
            .filter(shift => shift.jobs.length > 0),
        ] as const)
        .filter(([, shifts]) => shifts.length > 0)
    );
  }, [shiftsByDay, dayFilter, includeStaffOnly]);

  // Format name for display: "First Last (playaName)"
  const formatUserName = (user: WorkScheduleUser): string => {
    const fullName = `${user.firstName} ${user.lastName}`;
    return user.playaName ? `${fullName} (${user.playaName})` : fullName;
  };

  // Export data to CSV using shared utility function
  const exportCsv = (): void => {
    if (!workScheduleData) return;
    
    // CSV headers
    const headers = ['Day', 'Shift', 'Shift Time', 'Job', 'Registrations', 'User'];
    
    const csvRows: (string | number | null | undefined)[][] = [];
    
    // Process each shift and its jobs
    Object.entries(filteredShiftsByDay).forEach(([day, shifts]) => {
      // Sort shifts by start time
      const sortedShifts = [...shifts].sort((a, b) => {
        const timeComparison =
          getTimeInMinutes(a.startTime) - getTimeInMinutes(b.startTime);
        return timeComparison || a.name.localeCompare(b.name);
      });
      
      sortedShifts.forEach(shift => {
        // Sort jobs alphabetically
        const sortedJobs = [...shift.jobs].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        sortedJobs.forEach(job => {
          const registrationCount = `${job.registrations.length} of ${job.maxRegistrations}`;
          
          if (job.registrations.length === 0) {
            // If no registrations, add one row with (none)
            csvRows.push([
              dayNames[day] || day,
              shift.name,
              `${shift.startTime} - ${shift.endTime}`,
              job.name,
              registrationCount,
              '(none)'
            ]);
          } else { 
            // Add a row for each registration
            job.registrations.forEach(registration => {
              csvRows.push([
                dayNames[day] || day,
                shift.name,
                `${shift.startTime} - ${shift.endTime}`,
                job.name,
                registrationCount, 
                formatUserName(registration.user)
              ]);
            });
          }
        });
      });
    });
    
    // Generate filename with current date
    const filename = `work_schedule_report_${dayFilter !== 'all' ? dayFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    
    // Use shared CSV download function with BOM for Unicode support
    downloadCsv(headers, csvRows, { filename });
  };

  const downloadPdf = async (): Promise<void> => {
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const download = await reports.generateWorkSchedulePdf(
        dayFilter === 'all'
          ? { includeStaffOnly }
          : { dayOfWeek: dayFilter, includeStaffOnly }
      );
      downloadFile(download.blob, download.filename);
    } catch (generationError) {
      console.error('Failed to generate work schedule PDF:', generationError);
      setPdfError(reports.getWorkScheduleReportErrorMessage(generationError));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Count total shifts, jobs, and registrations
  const summaryStats = useMemo(() => {
    if (!workScheduleData) return { shifts: 0, jobs: 0, registrations: 0 };
    
    const filteredShifts = Object.values(filteredShiftsByDay).flat();
    const jobs = filteredShifts.flatMap(shift => shift.jobs);
    const registrations = jobs.flatMap(job => job.registrations);
    
    return {
      shifts: filteredShifts.length,
      jobs: jobs.length,
      registrations: registrations.length
    };
  }, [filteredShiftsByDay, workScheduleData]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              to={PATHS.REPORTS}
              className="inline-flex items-center text-amber-600 hover:text-amber-700"
            >
              <ArrowLeft size={20} className="mr-1" />
              Back to Reports
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Work Schedule Report</h1>
              <p className="text-gray-600">View all shifts with assigned workers</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter size={16} className="mr-2" />
              Filters
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              <Download size={16} className="mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => void downloadPdf()}
              disabled={generatingPdf}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? (
                <LoadingSpinner
                  size="sm"
                  className="!p-0 mr-2 [&_svg]:!text-white"
                />
              ) : (
                <Download size={16} className="mr-2" />
              )}
              {generatingPdf ? 'Generating PDF…' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="day-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week
                </label>
                <select
                  id="day-filter"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="all">All Days</option>
                  {availableDays.map(day => (
                    <option key={day} value={day}>
                      {dayNames[day] || day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label
                  htmlFor="staff-only-filter"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700"
                >
                  <input
                    id="staff-only-filter"
                    type="checkbox"
                    checked={includeStaffOnly}
                    onChange={event => setIncludeStaffOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  Show staff-only jobs
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setDayFilter('all');
                    setIncludeStaffOnly(true);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Error Message */}
        {scheduleError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{scheduleError}</p>
            <button
              onClick={() => void fetchWorkSchedule()}
              className="mt-2 text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* PDF Error Message */}
        {pdfError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{pdfError}</p>
            <button
              onClick={() => void downloadPdf()}
              className="mt-2 text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Work Schedule Data */}
        <div className="bg-white rounded-lg shadow p-6">
          {Object.keys(filteredShiftsByDay).length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Data Available</h3>
              <p className="text-gray-600">
                There are no shifts or jobs in the schedule matching your criteria.
              </p>
            </div>
          ) : (
            <>
              {Object.entries(filteredShiftsByDay)
                .sort(([dayA], [dayB]) => {
                  const indexA = dayOrder.indexOf(dayA);
                  const indexB = dayOrder.indexOf(dayB);
                  return indexA - indexB;
                })
                .map(([day, shifts]) => (
                  <div key={day} className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      {dayNames[day] || day}
                    </h2>
                    
                    {/* Sort shifts by start time */}
                    {[...shifts]
                      .sort((a, b) => {
                        const timeComparison =
                          getTimeInMinutes(a.startTime) - getTimeInMinutes(b.startTime);
                        return timeComparison || a.name.localeCompare(b.name);
                      })
                      .map(shift => (
                        <div key={shift.id} className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {shift.name} ({shift.startTime} - {shift.endTime})
                          </h3>
                          
                          <div className="pl-4 border-l-2 border-amber-200">
                            {/* Sort jobs alphabetically */}
                            {[...shift.jobs]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(job => (
                                <div key={job.id} className="mb-4">
                                  <h4 className="text-md font-medium text-gray-700 mb-2">
                                    {job.name} ({job.registrations.length} of {job.maxRegistrations})
                                  </h4>
                                  
                                  <div className="pl-4">
                                    {job.registrations.length > 0 ? (
                                      <ul className="list-disc pl-5">
                                        {job.registrations.map(registration => (
                                          <li key={registration.id} className="text-gray-600">
                                            {formatUserName(registration.user)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-gray-500 italic pl-5">(none)</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
            </>
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Shifts:</span>
              <span className="ml-2">{summaryStats.shifts}</span>
            </div>
            <div>
              <span className="font-medium">Total Jobs:</span>
              <span className="ml-2">{summaryStats.jobs}</span>
            </div>
            <div>
              <span className="font-medium">Total Registrations:</span>
              <span className="ml-2">{summaryStats.registrations}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
