import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegistration, RegistrationFormData, Shift } from '../../hooks/useRegistration';
import { JobCategory } from '../../lib/api';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const {
    campingOptions,
    jobCategories,
    shifts,
    loading,
    error,
    fetchCampingOptions,
    fetchJobCategories,
    fetchShifts,
    submitRegistration,
  } = useRegistration();

  const [formData, setFormData] = useState<RegistrationFormData>({
    campingOptions: [],
    customFields: {},
    shifts: [],
    acceptedTerms: false,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch initial data on component mount
  useEffect(() => {
    fetchCampingOptions();
    fetchJobCategories();
  }, [fetchCampingOptions, fetchJobCategories]);

  // When camping options change, fetch shifts
  useEffect(() => {
    if (formData.campingOptions.length > 0 || hasAlwaysRequiredCategories(jobCategories)) {
      fetchShifts(formData.campingOptions);
    }
  }, [formData.campingOptions, jobCategories, fetchShifts]);

  // Check if there are any always required job categories
  const hasAlwaysRequiredCategories = (categories: JobCategory[]): boolean => {
    return categories.some(category => category.alwaysRequired);
  };

  // Get always required categories
  const getAlwaysRequiredCategories = (): JobCategory[] => {
    return jobCategories.filter(category => category.alwaysRequired);
  };

  // Get shifts for always required categories
  const getAlwaysRequiredShifts = (): Shift[] => {
    const alwaysRequiredCategoryIds = getAlwaysRequiredCategories().map(cat => cat.id);
    return shifts.filter(shift => alwaysRequiredCategoryIds.includes(shift.jobCategoryId));
  };

  // Get shifts for selected camping options (excluding always required)
  const getCampingOptionShifts = (): Shift[] => {
    const alwaysRequiredCategoryIds = getAlwaysRequiredCategories().map(cat => cat.id);
    return shifts.filter(shift => !alwaysRequiredCategoryIds.includes(shift.jobCategoryId));
  };

  // Calculate total shifts required based on camping options and always required categories
  const calculateRequiredShiftCount = (): number => {
    // Get shift requirements from camping options
    const selectedOptions = campingOptions.filter(option => 
      formData.campingOptions.includes(option.id)
    );
    
    const campingShiftsRequired = selectedOptions.reduce(
      (total, option) => total + option.shiftsRequired, 
      0
    );
    
    // Every always required category adds at least one required shift
    const alwaysRequiredCount = getAlwaysRequiredCategories().length;
    
    return campingShiftsRequired + alwaysRequiredCount;
  };

  // Validate the current step
  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (currentStep === 1) {
      // Validate camping options selection
      if (formData.campingOptions.length === 0) {
        errors.campingOptions = 'Please select at least one camping option';
      }
    } else if (currentStep === 2) {
      // Validate shifts selection
      const requiredCount = calculateRequiredShiftCount();
      if (formData.shifts.length < requiredCount) {
        errors.shifts = `You need to select at least ${requiredCount} shifts`;
      }
      
      // Ensure all always required categories have at least one shift
      const alwaysRequiredCategories = getAlwaysRequiredCategories();
      
      alwaysRequiredCategories.forEach(category => {
        const categoryShifts = shifts.filter(
          shift => shift.jobCategoryId === category.id
        );
        
        const selectedCategoryShifts = categoryShifts.filter(
          shift => formData.shifts.includes(shift.id)
        );
        
        if (selectedCategoryShifts.length === 0) {
          errors[`category_${category.id}`] = 
            `You must select at least one ${category.name} shift`;
        }
      });
    } else if (currentStep === 3) {
      // Validate terms acceptance
      if (!formData.acceptedTerms) {
        errors.acceptedTerms = 'You must accept the terms to continue';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep()) {
      return;
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        await submitRegistration(formData);
        navigate('/dashboard'); // Redirect to dashboard after successful registration
      } catch (err) {
        console.error('Registration failed:', err);
      }
    }
  };

  // Handle camping option selection
  const handleCampingOptionChange = (optionId: string) => {
    setFormData(prev => {
      const updatedOptions = prev.campingOptions.includes(optionId)
        ? prev.campingOptions.filter(id => id !== optionId)
        : [...prev.campingOptions, optionId];
      
      return {
        ...prev,
        campingOptions: updatedOptions
      };
    });
  };

  // Handle shift selection
  const handleShiftChange = (shiftId: string) => {
    setFormData(prev => {
      const updatedShifts = prev.shifts.includes(shiftId)
        ? prev.shifts.filter(id => id !== shiftId)
        : [...prev.shifts, shiftId];
      
      return {
        ...prev,
        shifts: updatedShifts
      };
    });
  };

  // Render camping options step
  const renderCampingOptionsStep = () => {
    const availableOptions = campingOptions.filter(option => 
      option.enabled && (option.maxSignups === 0 || (option.currentSignups || 0) < option.maxSignups)
    );
    
    const fullOptions = campingOptions.filter(option => 
      option.enabled && option.maxSignups > 0 && (option.currentSignups || 0) >= option.maxSignups
    );
    
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Camping Options</h2>
        
        {availableOptions.length === 0 && (
          <div className="text-red-600 mb-4">No camping options available</div>
        )}
        
        <div className="space-y-4">
          {availableOptions.map(option => (
            <div key={option.id} className="border p-4 rounded">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={formData.campingOptions.includes(option.id)}
                  onChange={() => handleCampingOptionChange(option.id)}
                />
                <div className="ml-2">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-sm text-gray-600">
                    Dues: ${option.participantDues} | Required Shifts: {option.shiftsRequired}
                  </div>
                  {option.maxSignups > 0 && (
                    <div className="text-sm text-gray-600">
                      Availability: {option.maxSignups - (option.currentSignups || 0)} of {option.maxSignups} remaining
                    </div>
                  )}
                </div>
              </label>
            </div>
          ))}
          
          {fullOptions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Full Options (Not Available)</h3>
              {fullOptions.map(option => (
                <div key={option.id} className="border p-4 rounded bg-gray-100 opacity-70">
                  <div className="font-medium">{option.name} (Full)</div>
                  <div className="text-sm text-gray-600">
                    Dues: ${option.participantDues} | Required Shifts: {option.shiftsRequired}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {formErrors.campingOptions && (
          <div className="text-red-600 mt-2">{formErrors.campingOptions}</div>
        )}
      </div>
    );
  };

  // Render shifts step
  const renderShiftsStep = () => {
    const requiredCount = calculateRequiredShiftCount();
    const alwaysRequiredShifts = getAlwaysRequiredShifts();
    const campingOptionShifts = getCampingOptionShifts();
    const alwaysRequiredCategories = getAlwaysRequiredCategories();
    
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Work Shifts</h2>
        <p className="mb-4">
          You need to select at least {requiredCount} shifts to complete registration.
        </p>
        
        {/* Always Required Job Categories Section */}
        {alwaysRequiredCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Required Shifts</h3>
            <p className="text-sm text-gray-700 mb-4">
              These shifts are required for all participants regardless of camping options.
              You must select at least one shift from each required category.
            </p>
            
            {alwaysRequiredCategories.map(category => {
              const categoryShifts = alwaysRequiredShifts.filter(
                shift => shift.jobCategoryId === category.id
              );
              
              const errorKey = `category_${category.id}`;
              
              return (
                <div key={category.id} className="mb-6">
                  <h4 className="font-medium mb-2">{category.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                  
                  {formErrors[errorKey] && (
                    <div className="text-red-600 mb-2">{formErrors[errorKey]}</div>
                  )}
                  
                  <div className="space-y-2">
                    {categoryShifts.map(shift => (
                      <div key={shift.id} className="border p-3 rounded">
                        <label className="flex items-start">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={formData.shifts.includes(shift.id)}
                            onChange={() => handleShiftChange(shift.id)}
                          />
                          <div className="ml-2">
                            <div>{shift.jobName || 'Unknown Job'}</div>
                            <div className="text-sm text-gray-600">
                              {shift.day} | {shift.startTime} - {shift.endTime}
                            </div>
                            <div className="text-sm text-gray-600">
                              Spots: {shift.maxParticipants - (shift.currentParticipants || 0)} of {shift.maxParticipants} available
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                    
                    {categoryShifts.length === 0 && (
                      <div className="text-amber-600">No shifts available for this category</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Camping Option Shifts Section */}
        {campingOptionShifts.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2">Camping Option Shifts</h3>
            <p className="text-sm text-gray-700 mb-4">
              These shifts are available based on your selected camping options.
            </p>
            
            <div className="space-y-2">
              {campingOptionShifts.map(shift => (
                <div key={shift.id} className="border p-3 rounded">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={formData.shifts.includes(shift.id)}
                      onChange={() => handleShiftChange(shift.id)}
                    />
                    <div className="ml-2">
                      <div>{shift.jobName || 'Unknown Job'}</div>
                      <div className="text-sm text-gray-600">
                        Category: {shift.categoryName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {shift.day} | {shift.startTime} - {shift.endTime}
                      </div>
                      <div className="text-sm text-gray-600">
                        Spots: {shift.maxParticipants - (shift.currentParticipants || 0)} of {shift.maxParticipants} available
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {formErrors.shifts && (
          <div className="text-red-600 mt-2">{formErrors.shifts}</div>
        )}
      </div>
    );
  };

  // Render terms step
  const renderTermsStep = () => {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Review & Accept Terms</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Selected Camping Options</h3>
          <ul className="list-disc pl-5">
            {formData.campingOptions.map(optionId => {
              const option = campingOptions.find(o => o.id === optionId);
              return option ? (
                <li key={optionId}>{option.name} - ${option.participantDues}</li>
              ) : null;
            })}
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Selected Shifts</h3>
          <ul className="list-disc pl-5">
            {formData.shifts.map(shiftId => {
              const shift = shifts.find(s => s.id === shiftId);
              return shift ? (
                <li key={shiftId}>
                  {shift.jobName} | {shift.day} | {shift.startTime} - {shift.endTime}
                </li>
              ) : null;
            })}
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Terms & Conditions</h3>
          <div className="border p-4 rounded bg-gray-50 h-40 overflow-y-auto mb-4">
            <p>
              Terms and conditions text would go here. This would be pulled from the API.
            </p>
          </div>
          
          <label className="flex items-start">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={formData.acceptedTerms}
              onChange={() => setFormData(prev => ({
                ...prev, 
                acceptedTerms: !prev.acceptedTerms
              }))}
            />
            <span className="ml-2">
              I accept the terms and conditions
            </span>
          </label>
          
          {formErrors.acceptedTerms && (
            <div className="text-red-600 mt-2">{formErrors.acceptedTerms}</div>
          )}
        </div>
      </div>
    );
  };

  // Render the current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderCampingOptionsStep();
      case 2:
        return renderShiftsStep();
      case 3:
        return renderTermsStep();
      default:
        return null;
    }
  };

  if (loading && !shifts.length && !campingOptions.length) {
    return <div className="p-6">Loading registration data...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Camp Registration</h1>
      
      {/* Step Progress Indicator */}
      <div className="flex mb-8">
        {[1, 2, 3].map(step => (
          <div key={step} className="flex-1">
            <div className={`h-2 ${step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className="mt-2 text-center text-sm">
              {step === 1 && 'Camping Options'}
              {step === 2 && 'Work Shifts'}
              {step === 3 && 'Review & Submit'}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit}>
        {renderCurrentStep()}
        
        <div className="mt-8 flex justify-between">
          {currentStep > 1 && (
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </button>
          )}
          
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {currentStep < 3 ? 'Continue' : 'Complete Registration'}
          </button>
        </div>
      </form>
    </div>
  );
}
