import { useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { useJobs } from '../hooks/useJobs';
import { Shift } from '../lib/api';
import { isAxiosError } from 'axios';

interface ShiftFormState {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  campId: string;
}

const dayOfWeekOptions = [
  { value: 'PRE_OPENING', label: 'Pre-Opening' },
  { value: 'OPENING_SUNDAY', label: 'Opening Sunday' },
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'CLOSING_SUNDAY', label: 'Closing Sunday' },
  { value: 'POST_EVENT', label: 'Post-Event' },
];

export default function AdminShiftsPage() {
  const {
    shifts,
    loading: shiftsLoading,
    createShift,
    updateShift,
    deleteShift,
    error: shiftsError,
  } = useShifts();

  const {
    jobs,
    loading: jobsLoading,
  } = useJobs();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftFormState>({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    dayOfWeek: 'MONDAY',
    campId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [registrationsOpen, setRegistrationsOpen] = useState(false);
  const [registrations, setRegistrations] = useState<unknown[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const openAddModal = () => {
    setEditId(null);
    setForm({
      name: '',
      description: '',
      startTime: getTodayAtTime('09:00'),
      endTime: getTodayAtTime('17:00'),
      dayOfWeek: 'MONDAY',
      campId: 'default-camp-id',
    });
    setFormError(null);
    setDeleteError(null);
    setDeleteId(null);
    setModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditId(shift.id);
    setForm({
      name: shift.name || '',
      description: shift.description || '',
      startTime: formatDateForInput(shift.startTime),
      endTime: formatDateForInput(shift.endTime),
      dayOfWeek: shift.dayOfWeek,
      campId: shift.campId || 'default-camp-id',
    });
    setFormError(null);
    setDeleteError(null);
    setDeleteId(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormError(null);
    setDeleteError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setForm({ ...form, [name]: numValue });
      }
    } else if (type === 'time' && (name === 'startTime' || name === 'endTime')) {
      // For time inputs, combine with static date (January 1, 2025)
      const [hours, minutes] = value.split(':').map(Number);
      const staticDate = new Date(2025, 0, 1); // January 1, 2025
      staticDate.setHours(hours, minutes, 0, 0);
      setForm({ ...form, [name]: staticDate.toISOString() });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields: name, description, startTime, endTime, dayOfWeek
    if (!form.name || !form.description || !form.startTime || !form.endTime || !form.dayOfWeek) {
      setFormError('Name, description, day, start time, and end time are required.');
      return;
    }
    
    setFormError(null);
    
    try {
      // Ensure campId is set before submission and format dates correctly
      const shiftData = {
        ...form,
        campId: form.campId || 'default-camp-id',
        // Convert ISO strings to Date objects as expected by the API
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      };
      
      if (editId) {
        await updateShift(editId, shiftData);
      } else {
        await createShift(shiftData);
      }
      closeModal();
    } catch (error) {
      let errorMessage = 'Failed to save shift.';
      if (isAxiosError(error) && error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message) 
          ? error.response.data.message.join(', ') 
          : error.response.data.message;
      }
      setFormError(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
    try {
      await deleteShift(id);
      setDeleteId(null);
      setDeleteError(null);
    } catch (err: unknown) {
      let message = 'Failed to delete shift.';
      
      // Extract error message from Axios error
      if (isAxiosError(err) && err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      
      setDeleteError(message);
      setDeleteId(null);
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateForInput = (dateString: string): string => {
    const date = new Date(dateString);
    // Extract only the time part (HH:MM)
    return date.toTimeString().substring(0, 5);
  };

  const getTodayAtTime = (timeString: string): string => {
    // Use a static date (January 1, 2025) with the specified time
    const [hours, minutes] = timeString.split(':').map(Number);
    const staticDate = new Date(2025, 0, 1); // January 1, 2025
    staticDate.setHours(hours, minutes, 0, 0);
    return staticDate.toISOString();
  };

  const getDayOfWeekLabel = (value: string): string => {
    const option = dayOfWeekOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const viewRegistrations = () => {
    setRegistrationsOpen(true);
    setRegistrationsLoading(true);
    try {
      // Mock data until API integration is implemented
      setRegistrations([]);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const closeRegistrationsModal = () => {
    setRegistrationsOpen(false);
  };

  const getJobsForShift = (shiftId: string): string => {
    const shiftJobs = jobs.filter(job => job.shiftId === shiftId);
    return shiftJobs.map(job => job.name).join(', ') || 'None';
  };

  const loading = shiftsLoading || jobsLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          onClick={openAddModal}
          disabled={loading}
        >
          Add Shift
        </button>
      </div>
      
      {(shiftsError) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {shiftsError}
        </div>
      )}
      
      {deleteError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {deleteError}
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">No shifts found.</td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getJobsForShift(shift.id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDayOfWeekLabel(shift.dayOfWeek)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateForDisplay(shift.startTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateForDisplay(shift.endTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                        onClick={() => viewRegistrations()}
                      >
                        Registrations
                      </button>
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        onClick={() => openEditModal(shift)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDelete(shift.id)}
                        disabled={deleteId === shift.id}
                      >
                        {deleteId === shift.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Shift Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editId ? 'Edit' : 'Add'} Shift</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block font-medium mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  maxLength={100}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block font-medium mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  id="description"
                  name="description"
                  className="w-full border rounded px-3 py-2"
                  value={form.description}
                  onChange={handleFormChange}
                  maxLength={500}
                  rows={2}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="dayOfWeek" className="block font-medium mb-1">Day <span className="text-red-500">*</span></label>
                <select
                  id="dayOfWeek"
                  name="dayOfWeek"
                  className="w-full border rounded px-3 py-2"
                  value={form.dayOfWeek}
                  onChange={handleFormChange}
                  required
                >
                  {dayOfWeekOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="startTime" className="block font-medium mb-1">Start Time <span className="text-red-500">*</span></label>
                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={formatDateForInput(form.startTime)}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="endTime" className="block font-medium mb-1">End Time <span className="text-red-500">*</span></label>
                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={formatDateForInput(form.endTime)}
                  onChange={handleFormChange}
                  required
                />
              </div>
              {formError && <div className="text-red-600 mb-2">{formError}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {editId ? 'Save Changes' : 'Add Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Registrations Modal */}
      {registrationsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Shift Registrations</h2>
            {registrationsLoading ? (
              <div className="text-center py-4">Loading registrations...</div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-4">No registrations found for this shift.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Placeholder for registration data */}
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900" colSpan={3}>
                        Registration data will be shown here
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={closeRegistrationsModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 