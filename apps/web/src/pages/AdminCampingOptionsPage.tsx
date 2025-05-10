import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampingOptions } from '../hooks/useCampingOptions';
import { CampingOption } from '../lib/api';

interface CampingOptionFormData {
  name: string;
  description: string;
  enabled: boolean;
  workShiftsRequired: number;
  participantDues: number;
  staffDues: number;
  maxSignups: number;
  campId?: string;
  jobCategoryIds: string[];
}

/**
 * Admin page for managing camping options
 */
const AdminCampingOptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    options, 
    loading, 
    error, 
    loadCampingOptions, 
    createCampingOption,
    updateCampingOption,
    deleteCampingOption 
  } = useCampingOptions();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<CampingOption | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CampingOptionFormData>({
    name: '',
    description: '',
    enabled: true,
    workShiftsRequired: 0,
    participantDues: 0,
    staffDues: 0,
    maxSignups: 0,
    jobCategoryIds: [],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load camping options on component mount
  useEffect(() => {
    loadCampingOptions(true);
  }, [loadCampingOptions]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (formData.participantDues < 0) {
      errors.participantDues = 'Participant dues cannot be negative';
    }

    if (formData.staffDues < 0) {
      errors.staffDues = 'Staff dues cannot be negative';
    }

    if (formData.maxSignups < 0) {
      errors.maxSignups = 'Max signups cannot be negative';
    }

    if (formData.workShiftsRequired < 0) {
      errors.workShiftsRequired = 'Work shifts required cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddOption = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      workShiftsRequired: 0,
      participantDues: 0,
      staffDues: 0,
      maxSignups: 0,
      jobCategoryIds: [],
    });
    setFormErrors({});
    setSelectedOption(null);
    setIsModalOpen(true);
  };

  const handleEditOption = (option: CampingOption) => {
    setFormData({
      name: option.name,
      description: option.description || '',
      enabled: option.enabled,
      workShiftsRequired: option.workShiftsRequired,
      participantDues: option.participantDues,
      staffDues: option.staffDues,
      maxSignups: option.maxSignups,
      campId: option.campId,
      jobCategoryIds: option.jobCategoryIds,
    });
    setFormErrors({});
    setSelectedOption(option);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteOptionId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteOptionId) {
      await deleteCampingOption(deleteOptionId);
      setIsDeleteModalOpen(false);
      setDeleteOptionId(null);
    }
  };

  const handleManageFields = (optionId: string) => {
    navigate(`/admin/camping-options/${optionId}/fields`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (selectedOption) {
        // Update existing option
        await updateCampingOption(selectedOption.id, formData);
      } else {
        // Create new option - use data with empty campId omitted
        const dataToSend = { ...formData };
        
        // Remove empty campId if it exists to let backend set it automatically
        if (dataToSend.campId === '') {
          delete dataToSend.campId;
        }
        
        await createCampingOption(dataToSend);
      }
      
      setIsModalOpen(false);
      
      // Refresh the list of camping options
      loadCampingOptions(true);
    } catch (err) {
      console.error('Error saving camping option:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Camping Options</h1>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleAddOption}
        >
          Add Camping Option
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <p>Loading camping options...</p>
        </div>
      ) : (
        <>
          {options.length === 0 ? (
            <div className="bg-gray-100 p-6 rounded text-center">
              <p className="text-gray-700">No camping options found. Click the button above to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left">Name</th>
                    <th className="py-2 px-4 border-b text-left">Status</th>
                    <th className="py-2 px-4 border-b text-right">Participant Dues</th>
                    <th className="py-2 px-4 border-b text-right">Staff Dues</th>
                    <th className="py-2 px-4 border-b text-right">Registrations</th>
                    <th className="py-2 px-4 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((option) => (
                    <tr key={option.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border-b">{option.name}</td>
                      <td className="py-2 px-4 border-b">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                            option.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {option.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b text-right">${option.participantDues.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-right">${option.staffDues.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b text-right">
                        {option.currentRegistrations !== undefined
                          ? `${option.currentRegistrations} / ${option.maxSignups || 'Unlimited'}`
                          : 'N/A'}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleEditOption(option)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleManageFields(option.id)}
                            className="text-green-500 hover:text-green-700"
                          >
                            Fields
                          </button>
                          <button
                            onClick={() => handleDeleteClick(option.id)}
                            className="text-red-500 hover:text-red-700"
                            disabled={option.currentRegistrations !== undefined && option.currentRegistrations > 0}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this camping option? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {selectedOption ? 'Edit Camping Option' : 'Add Camping Option'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Name */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">
                    Name*
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                
                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                {/* Enabled Status */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="enabled">
                    Status
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabled"
                      name="enabled"
                      checked={formData.enabled}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                      Enabled
                    </label>
                  </div>
                </div>
                
                {/* Participant Dues */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="participantDues">
                    Participant Dues ($)
                  </label>
                  <input
                    type="number"
                    id="participantDues"
                    name="participantDues"
                    value={formData.participantDues}
                    onChange={handleInputChange}
                    min={0}
                    step={0.01}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.participantDues ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.participantDues && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.participantDues}</p>
                  )}
                </div>
                
                {/* Staff Dues */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="staffDues">
                    Staff Dues ($)
                  </label>
                  <input
                    type="number"
                    id="staffDues"
                    name="staffDues"
                    value={formData.staffDues}
                    onChange={handleInputChange}
                    min={0}
                    step={0.01}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.staffDues ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.staffDues && <p className="text-red-500 text-xs mt-1">{formErrors.staffDues}</p>}
                </div>
                
                {/* Work Shifts Required */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="workShiftsRequired">
                    Work Shifts Required
                  </label>
                  <input
                    type="number"
                    id="workShiftsRequired"
                    name="workShiftsRequired"
                    value={formData.workShiftsRequired}
                    onChange={handleInputChange}
                    min={0}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.workShiftsRequired ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.workShiftsRequired && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.workShiftsRequired}</p>
                  )}
                </div>
                
                {/* Max Signups */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="maxSignups">
                    Max Signups (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    id="maxSignups"
                    name="maxSignups"
                    value={formData.maxSignups}
                    onChange={handleInputChange}
                    min={0}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.maxSignups ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.maxSignups && <p className="text-red-500 text-xs mt-1">{formErrors.maxSignups}</p>}
                </div>
                
                {/* Job Category IDs (simplified for now) */}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">Job Categories</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Job category selection will be implemented in a future iteration.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampingOptionsPage; 