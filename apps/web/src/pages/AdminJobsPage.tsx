import { useState, useEffect, useCallback } from 'react';
import { useJobs } from '../hooks/useJobs';
import { useJobCategories } from '../hooks/useJobCategories';
import { useShifts } from '../hooks/useShifts';
import { Job } from '../lib/api';
import { isAxiosError } from 'axios';

interface JobFormState {
  name: string;
  description: string;
  location: string;
  categoryId: string;
  shiftId: string;
  maxRegistrations: number;
}

export default function AdminJobsPage() {
  const {
    jobs,
    loading: jobsLoading,
    createJob,
    updateJob,
    deleteJob,
    error: jobsError,
  } = useJobs();

  const {
    categories,
    loading: categoriesLoading,
  } = useJobCategories();

  const {
    shifts,
    loading: shiftsLoading,
  } = useShifts();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>({
    name: '',
    description: '',
    location: '',
    categoryId: '',
    shiftId: '',
    maxRegistrations: 5,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'shift' | 'maxRegistrations'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const formatTime = useCallback((timeString: string): string => {
    try {
      // Check if timeString is already a time string in HH:MM format
      if (/^\d{2}:\d{2}$/.test(timeString)) {
        return timeString;
      }
      
      const date = new Date(timeString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timeString;
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      // Return the original string if parsing fails
      return timeString;
    }
  }, []);
  
  const getFriendlyDayName = useCallback((day: string): string => {
    if (!day) return '';
    
    const dayMap: Record<string, string> = {
      // Standard days
      MONDAY: 'Monday',
      TUESDAY: 'Tuesday',
      WEDNESDAY: 'Wednesday',
      THURSDAY: 'Thursday',
      FRIDAY: 'Friday',
      SATURDAY: 'Saturday',
      SUNDAY: 'Sunday',
      // Special event days from schema
      PRE_OPENING: 'Pre-Opening',
      OPENING_SUNDAY: 'Opening Sunday',
      CLOSING_SUNDAY: 'Closing Sunday',
      POST_EVENT: 'Post-Event',
      // Handle lowercase versions too
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      pre_opening: 'Pre-Opening',
      opening_sunday: 'Opening Sunday',
      closing_sunday: 'Closing Sunday',
      post_event: 'Post-Event'
    };
    return dayMap[day] || day; // Return mapped value or original if not found
  }, []);
  
  const getCategoryNameById = useCallback((id: string): string => {
    const category = categories.find(cat => cat.id === id);
    return category ? category.name : '';
  }, [categories]);
  
  const getCategoryById = useCallback((id: string) => {
    return categories.find(cat => cat.id === id);
  }, [categories]);
  
  const getShiftNameById = useCallback((id: string): string => {
    const shift = shifts.find(s => s.id === id);
    return shift ? shift.name : '';
  }, [shifts]);
  
  const getShiftDetails = useCallback((job: Job): string => {
    let dayName = '';
    let startTime = '';
    let endTime = '';
    
    // Handle the case where shift details are in the shift property
    if (job.shift) {
      dayName = getFriendlyDayName(job.shift.dayOfWeek);
      startTime = formatTime(job.shift.startTime);
      endTime = formatTime(job.shift.endTime);
    } else {
      // Handle case where shift data is directly on the job
      const shift = shifts.find(s => s.id === job.shiftId);
      if (shift) {
        dayName = getFriendlyDayName(shift.dayOfWeek);
        startTime = formatTime(shift.startTime);
        endTime = formatTime(shift.endTime);
      }
    }
    
    if (!dayName || !startTime || !endTime) {
      return getShiftNameById(job.shiftId);
    }
    
    return `${dayName}, ${startTime} - ${endTime}`;
  }, [shifts, getFriendlyDayName, formatTime, getShiftNameById]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !form.categoryId) {
      setForm(prevForm => ({
        ...prevForm,
        categoryId: categories[0].id
      }));
    }
  }, [categories, form.categoryId]);

  // Handle column header clicks for sorting
  const handleSortClick = useCallback((column: 'name' | 'category' | 'shift' | 'maxRegistrations') => {
    setSortDirection(prevDirection => {
      // If clicking the same column, toggle direction
      if (sortColumn === column) {
        return prevDirection === 'asc' ? 'desc' : 'asc';
      }
      // Default to ascending for a new column
      return 'asc';
    });
    setSortColumn(column);
  }, [sortColumn]);

  // Filter and sort jobs
  useEffect(() => {
    // Create a sorted copy of the jobs array
    const sortedJobs = [...jobs].sort((a, b) => {
      let comparison = 0;
      
      // Sort based on the selected column
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'category':
          comparison = getCategoryNameById(a.categoryId).localeCompare(
            getCategoryNameById(b.categoryId),
            undefined,
            { sensitivity: 'base' }
          );
          break;
        case 'shift':
          // Sort by the display value of the shift
          comparison = getShiftDetails(a).localeCompare(
            getShiftDetails(b),
            undefined,
            { sensitivity: 'base' }
          );
          break;
        case 'maxRegistrations':
          comparison = a.maxRegistrations - b.maxRegistrations;
          break;
        default:
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      
      // Reverse the result if sorting in descending order
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Apply filter if search term exists
    if (searchTerm.trim() === '') {
      setFilteredJobs(sortedJobs);
    } else {
      const lowercaseSearchTerm = searchTerm.toLowerCase();
      setFilteredJobs(
        sortedJobs.filter(
          (job) =>
            job.name.toLowerCase().includes(lowercaseSearchTerm) ||
            getCategoryNameById(job.categoryId).toLowerCase().includes(lowercaseSearchTerm) ||
            getShiftNameById(job.shiftId).toLowerCase().includes(lowercaseSearchTerm)
        )
      );
    }
  }, [searchTerm, jobs, getCategoryNameById, getShiftNameById, sortColumn, sortDirection, getShiftDetails]);

  useEffect(() => {
    if (shifts.length > 0 && !form.shiftId) {
      setForm(prevForm => ({
        ...prevForm,
        shiftId: shifts[0].id
      }));
    }
  }, [shifts, form.shiftId]);

  const openAddModal = () => {
    setEditId(null);
    setForm({
      name: '',
      description: '',
      location: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      shiftId: shifts.length > 0 ? shifts[0].id : '',
      maxRegistrations: 5,
    });
    setFormError(null);
    setDeleteError(null);
    setDeleteId(null);
    setModalOpen(true);
  };

  const openEditModal = (job: Job) => {
    setEditId(job.id);
    setForm({
      name: job.name,
      description: job.description,
      location: job.location,
      categoryId: job.categoryId,
      shiftId: job.shiftId,
      maxRegistrations: job.maxRegistrations,
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
    const value = 
      e.target.type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : e.target.type === 'number'
          ? parseInt(e.target.value, 10)
          : e.target.value;
    
    setForm({ ...form, [e.target.name]: value });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim() || !form.location.trim() || !form.categoryId || !form.shiftId) {
      setFormError('All fields are required.');
      return;
    }
    
    if (form.maxRegistrations <= 0) {
      setFormError('Maximum registrations must be a positive number.');
      return;
    }
    
    setFormError(null);
    if (editId) {
      await updateJob(editId, form);
    } else {
      await createJob(form);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
    try {
      await deleteJob(id);
      setDeleteId(null);
      setDeleteError(null);
    } catch (err: unknown) {
      let message = 'Failed to delete job.';
      
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

  const loading = jobsLoading || categoriesLoading || shiftsLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <div className="ml-auto flex space-x-2">
          <div className="flex items-center">
            <div className="relative mr-2">
              <input
                type="text"
                className="w-64 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={handleSearchChange}
                aria-label="Search jobs"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
            <button
              onClick={() => window.location.href = '/admin'}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Back to Admin
            </button>
            <button
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 ml-2"
              onClick={openAddModal}
              disabled={loading}
            >
              Add Job
            </button>
          </div>
        </div>
      </div>
      
      {(jobsError) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {jobsError}
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
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSortClick('name')}
                  aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center">
                    <span>Name</span>
                    {sortColumn === 'name' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSortClick('category')}
                  aria-sort={sortColumn === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center">
                    <span>Category</span>
                    {sortColumn === 'category' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSortClick('shift')}
                  aria-sort={sortColumn === 'shift' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center">
                    <span>Shift</span>
                    {sortColumn === 'shift' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSortClick('maxRegistrations')}
                  aria-sort={sortColumn === 'maxRegistrations' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center">
                    <span>Max</span>
                    {sortColumn === 'maxRegistrations' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">No jobs found.</td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCategoryNameById(job.categoryId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getShiftDetails(job)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.maxRegistrations}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        onClick={() => openEditModal(job)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDelete(job.id)}
                        disabled={deleteId === job.id}
                      >
                        {deleteId === job.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editId ? 'Edit' : 'Add'} Job</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block font-medium mb-1">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block font-medium mb-1">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="w-full border rounded px-3 py-2"
                  value={form.description}
                  onChange={handleFormChange}
                  required
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="location" className="block font-medium mb-1">Location</label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.location}
                  onChange={handleFormChange}
                  required
                  maxLength={100}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="categoryId" className="block font-medium mb-1">Category</label>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="w-full border rounded px-3 py-2"
                  value={form.categoryId}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label htmlFor="shiftId" className="block font-medium mb-1">Shift</label>
                <select
                  id="shiftId"
                  name="shiftId"
                  className="w-full border rounded px-3 py-2"
                  value={form.shiftId}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select a shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} - {shift.dayOfWeek} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label htmlFor="maxRegistrations" className="block font-medium mb-1">Maximum Registrations</label>
                <input
                  id="maxRegistrations"
                  name="maxRegistrations"
                  type="number"
                  min="1"
                  className="w-full border rounded px-3 py-2"
                  value={form.maxRegistrations}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              {/* Display derived properties from the selected category */}
              {form.categoryId && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500 mb-2">These properties are inherited from the selected category:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-sm font-medium">Staff Only:</span>
                      <span className="text-sm ml-1">
                        {getCategoryById(form.categoryId)?.staffOnly ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Always Required:</span>
                      <span className="text-sm ml-1">
                        {getCategoryById(form.categoryId)?.alwaysRequired ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  {editId ? 'Save Changes' : 'Add Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 