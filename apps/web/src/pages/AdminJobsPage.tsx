import { useState, useEffect } from 'react';
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

  // Set initial categoryId when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !form.categoryId) {
      setForm(prevForm => ({
        ...prevForm,
        categoryId: categories[0].id
      }));
    }
  }, [categories, form.categoryId]);

  // Set initial shiftId when shifts are loaded
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

  const getCategoryNameById = (id: string): string => {
    const category = categories.find(cat => cat.id === id);
    return category ? category.name : 'Unknown Category';
  };

  const getCategoryById = (id: string) => {
    return categories.find(cat => cat.id === id);
  };

  const getShiftNameById = (id: string): string => {
    const shift = shifts.find(s => s.id === id);
    return shift ? `${shift.dayOfWeek} (${formatTime(shift.startTime)} - ${formatTime(shift.endTime)})` : 'Unknown Shift';
  };

  const formatTime = (timeString: string): string => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      // Return the original string if parsing fails
      return timeString;
    }
  };

  const loading = jobsLoading || categoriesLoading || shiftsLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          onClick={openAddModal}
          disabled={loading}
        >
          Add Job
        </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Registrations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Only</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Always Required</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">No jobs found.</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCategoryNameById(job.categoryId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getShiftNameById(job.shiftId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.maxRegistrations}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="italic text-gray-400">(from category)</span> {job.staffOnly ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="italic text-gray-400">(from category)</span> {job.alwaysRequired ? 'Yes' : 'No'}
                    </td>
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