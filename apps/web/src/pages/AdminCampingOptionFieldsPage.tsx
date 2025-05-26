import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampingOptions } from '../hooks/useCampingOptions';
import { CampingOptionField } from '../lib/api';
import axios, { AxiosError } from 'axios';
import { PATHS } from '../routes';

// Define type for API error response
interface ApiErrorResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

interface FieldFormData {
  displayName: string;
  description: string;
  dataType: 'STRING' | 'MULTILINE_STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'DATE';
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  order?: number;
}

const AdminCampingOptionFieldsPage: React.FC = () => {
  const { optionId } = useParams<{ optionId: string }>();
  const navigate = useNavigate();

  const {
    selectedOption,
    fields,
    loading,
    error,
    loadCampingOption,
    loadCampingOptionFields,
    createCampingOptionField,
    updateCampingOptionField,
    deleteCampingOptionField
  } = useCampingOptions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<CampingOptionField | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FieldFormData>({
    displayName: '',
    description: '',
    dataType: 'STRING',
    required: false,
    maxLength: null,
    minValue: null,
    maxValue: null
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<CampingOptionField | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Load camping option and its fields on component mount
  useEffect(() => {
    if (optionId) {
      loadCampingOption(optionId);
      loadCampingOptionFields(optionId);
    }
  }, [optionId, loadCampingOption, loadCampingOptionFields]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      errors.displayName = 'Display name is required';
    }

    if (formData.dataType === 'STRING' || formData.dataType === 'MULTILINE_STRING') {
      if (formData.maxLength && formData.maxLength < 1) {
        errors.maxLength = 'Maximum length must be at least 1';
      }
    }

    if (formData.dataType === 'NUMBER' || formData.dataType === 'INTEGER') {
      if (formData.minValue !== null && formData.maxValue !== null && formData.minValue > formData.maxValue) {
        errors.minValue = 'Minimum value cannot be greater than maximum value';
      }
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
      // Use null for empty values
      const numValue = value === '' ? null : parseFloat(value);
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDataTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dataType = e.target.value as FieldFormData['dataType'];
    
    // Reset constraints when changing data type
    const updatedFormData = {
      ...formData,
      dataType,
      maxLength: null,
      minValue: null,
      maxValue: null
    };
    
    setFormData(updatedFormData);
  };

  const handleAddField = () => {
    setFormData({
      displayName: '',
      description: '',
      dataType: 'STRING',
      required: false,
      maxLength: null,
      minValue: null,
      maxValue: null
    });
    setFormErrors({});
    setSelectedField(null);
    setIsModalOpen(true);
  };

  const handleEditField = (field: CampingOptionField) => {
    setFormData({
      displayName: field.displayName,
      description: field.description || '',
      dataType: field.dataType,
      required: field.required,
      maxLength: field.maxLength ?? null,
      minValue: field.minValue ?? null,
      maxValue: field.maxValue ?? null
    });
    setFormErrors({});
    setSelectedField(field);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteFieldId(id);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteFieldId || !optionId) return;
    
    setDeleteError(null);
    
    try {
      await deleteCampingOptionField(optionId, deleteFieldId);
      setIsDeleteModalOpen(false);
      setDeleteFieldId(null);
    } catch (err) {
      // Enhanced error handling for delete
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<ApiErrorResponse>;
        if (axiosError.response) {
          const errorData = axiosError.response.data;
          const errorMessage = Array.isArray(errorData.message) 
            ? errorData.message.join(', ') 
            : errorData.message || 'Failed to delete field';
          setDeleteError(errorMessage);
        } else {
          setDeleteError('Network error occurred. Please try again.');
        }
      } else {
        setDeleteError('An unexpected error occurred');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      // Create a mapped version of the form data that uses the backend expected types
      const mappedData = {
        ...formData,
        // No type conversion needed as we're now using the correct enum values directly
      };
      
      if (selectedField) {
        // Update existing field
        await updateCampingOptionField(
          optionId!,
          selectedField.id,
          mappedData
        );
      } else {
        // Create new field
        await createCampingOptionField(
          optionId!,
          mappedData
        );
      }
      
      setIsModalOpen(false);
    } catch (err) {
      // Enhanced error handling
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<ApiErrorResponse>;
        if (axiosError.response) {
          const errorData = axiosError.response.data;
          // Handle array of messages or single message
          const errorMessage = Array.isArray(errorData.message) 
            ? errorData.message.join(', ') 
            : errorData.message || 'An error occurred';
          setApiError(errorMessage);
        } else {
          setApiError('Network error occurred. Please try again.');
        }
      } else {
        setApiError('An unexpected error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate(PATHS.ADMIN_CAMPING_OPTIONS);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, field: CampingOptionField) => {
    setDraggedField(field);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedField || !optionId) return;
    
    const dragIndex = fields.findIndex(f => f.id === draggedField.id);
    if (dragIndex === dropIndex) return;
    
    setIsReordering(true);
    
    try {
      // Create new order for all fields
      const reorderedFields = [...fields];
      const [removed] = reorderedFields.splice(dragIndex, 1);
      reorderedFields.splice(dropIndex, 0, removed);
      
      // Create field orders array with new positions
      const fieldOrders = reorderedFields.map((field, index) => ({
        id: field.id,
        order: index
      }));
      
      // Call API to reorder fields using the campingOptions API
      const { campingOptions } = await import('../lib/api');
      await campingOptions.reorderFields(optionId, fieldOrders);
      
      // Reload fields to get updated order
      await loadCampingOptionFields(optionId);
    } catch (error) {
      console.error('Error reordering fields:', error);
      setApiError('Failed to reorder fields. Please try again.');
    } finally {
      setIsReordering(false);
      setDraggedField(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedField(null);
    setDragOverIndex(null);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button 
            onClick={handleBack}
            className="text-blue-500 hover:text-blue-700 mb-2 flex items-center"
          >
            <span className="mr-1">←</span> Back to Camping Options
          </button>
          <h1 className="text-2xl font-bold">
            {selectedOption ? `Fields for ${selectedOption.name}` : 'Custom Fields'}
          </h1>
        </div>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleAddField}
        >
          Add Custom Field
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <p>Loading fields...</p>
        </div>
      ) : (
        <>
          {fields.length === 0 ? (
            <div className="bg-gray-100 p-6 rounded text-center">
              <p className="text-gray-700">No custom fields found. Click the button above to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left">Order</th>
                    <th className="py-2 px-4 border-b text-left">Field Name</th>
                    <th className="py-2 px-4 border-b text-left">Type</th>
                    <th className="py-2 px-4 border-b text-left">Required</th>
                    <th className="py-2 px-4 border-b text-left">Constraints</th>
                    <th className="py-2 px-4 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr 
                      key={field.id} 
                      className={`hover:bg-gray-50 cursor-move ${
                        dragOverIndex === index ? 'bg-blue-100 border-blue-300' : ''
                      } ${isReordering ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="py-2 px-4 border-b text-gray-500">
                        <span className="flex items-center">
                          <span className="mr-2">⋮⋮</span>
                          {field.order ?? index}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b">{field.displayName}</td>
                      <td className="py-2 px-4 border-b">{field.dataType}</td>
                      <td className="py-2 px-4 border-b">
                        {field.required ? (
                          <span className="text-green-600">Required</span>
                        ) : (
                          <span className="text-gray-500">Optional</span>
                        )}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {field.dataType === 'STRING' && field.maxLength !== null && (
                          <span>Max length: {field.maxLength}</span>
                        )}
                        {field.dataType === 'NUMBER' && (
                          <span>
                            {field.minValue !== null && `Min: ${field.minValue}`}
                            {field.minValue !== null && field.maxValue !== null && ', '}
                            {field.maxValue !== null && `Max: ${field.maxValue}`}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleEditField(field)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(field.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isReordering && (
                <div className="mt-2 text-center text-gray-600">
                  <span>Reordering fields...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this field? This action cannot be undone.</p>
            
            {deleteError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{deleteError}</p>
              </div>
            )}
            
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
              {selectedField ? 'Edit Field' : 'Add Custom Field'}
            </h3>
            
            {apiError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{apiError}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Display Name */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">
                    Field Name*
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md ${
                      formErrors.displayName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.displayName && <p className="text-red-500 text-xs mt-1">{formErrors.displayName}</p>}
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
                
                {/* Data Type */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dataType">
                    Data Type*
                  </label>
                  <select
                    id="dataType"
                    name="dataType"
                    value={formData.dataType}
                    onChange={handleDataTypeChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="STRING">Text</option>
                    <option value="MULTILINE_STRING">Multiline Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="INTEGER">Integer</option>
                    <option value="DATE">Date</option>
                    <option value="BOOLEAN">Yes/No</option>
                  </select>
                </div>
                
                {/* Required */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="required">
                    Required Field
                  </label>
                  <div className="flex items-center h-10">
                    <input
                      type="checkbox"
                      id="required"
                      name="required"
                      checked={formData.required}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                      This field is required
                    </label>
                  </div>
                </div>
                
                {/* Additional fields based on data type */}
                {(formData.dataType === 'STRING' || formData.dataType === 'MULTILINE_STRING') && (
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="maxLength">
                      Maximum Length
                    </label>
                    <input
                      type="number"
                      id="maxLength"
                      name="maxLength"
                      value={formData.maxLength === null ? '' : formData.maxLength}
                      onChange={handleInputChange}
                      min={1}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.maxLength ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.maxLength && <p className="text-red-500 text-xs mt-1">{formErrors.maxLength}</p>}
                  </div>
                )}
                
                {(formData.dataType === 'NUMBER' || formData.dataType === 'INTEGER') && (
                  <>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="minValue">
                        Minimum Value
                      </label>
                      <input
                        type="number"
                        id="minValue"
                        name="minValue"
                        value={formData.minValue === null ? '' : formData.minValue}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-md ${
                          formErrors.minValue ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.minValue && <p className="text-red-500 text-xs mt-1">{formErrors.minValue}</p>}
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="maxValue">
                        Maximum Value
                      </label>
                      <input
                        type="number"
                        id="maxValue"
                        name="maxValue"
                        value={formData.maxValue === null ? '' : formData.maxValue}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-md ${
                          formErrors.maxValue ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.maxValue && <p className="text-red-500 text-xs mt-1">{formErrors.maxValue}</p>}
                    </div>
                  </>
                )}
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

export default AdminCampingOptionFieldsPage; 