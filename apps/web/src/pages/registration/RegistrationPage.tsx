import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegistration, RegistrationFormData, Shift } from '../../hooks/useRegistration';
import { JobCategory, Job } from '../../lib/api';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const {
    campingOptions,
    jobCategories,
    shifts,
    jobs,
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
    jobs: [],
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

  // Get jobs for always required categories
  const getAlwaysRequiredJobs = (): Job[] => {
    // Get job categories that are always required
    const alwaysRequiredCategoryIds = jobCategories
      .filter(cat => cat.alwaysRequired)
      .map(cat => cat.id);

    // Return jobs from always required categories
    return jobs.filter(job => 
      alwaysRequiredCategoryIds.includes(job.categoryId)
    );
  };

  // Get jobs for selected camping options (excluding always required)
  const getCampingOptionJobs = (): Job[] => {
    // Get jobs from non-always-required categories
    const alwaysRequiredCategoryIds = jobCategories
      .filter(cat => cat.alwaysRequired)
      .map(cat => cat.id);

    return jobs.filter(job => 
      !alwaysRequiredCategoryIds.includes(job.categoryId)
    );
  };

  // Calculate total jobs required based on camping options and always required categories
  const calculateRequiredJobCount = (): number => {
    // Get job requirements from camping options
    const selectedOptions = campingOptions.filter(option => 
      formData.campingOptions.includes(option.id)
    );
    
    const campingJobsRequired = selectedOptions.reduce(
      (total, option) => total + option.jobsRequired, 
      0
    );
    
    // Every always required category adds at least one required job
    const alwaysRequiredCount = getAlwaysRequiredCategories().length;
    
    return campingJobsRequired + alwaysRequiredCount;
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
      // Validate jobs selection
      const requiredCount = calculateRequiredJobCount();
      if (formData.jobs.length < requiredCount) {
        errors.jobs = `You need to select at least ${requiredCount} jobs`;
      }
      
      // Ensure all always required categories have at least one job
      const alwaysRequiredCategories = getAlwaysRequiredCategories();
      
      alwaysRequiredCategories.forEach(category => {
        const categoryJobs = getAlwaysRequiredJobs().filter(
          job => job.categoryId === category.id
        );
        
        const selectedCategoryJobs = categoryJobs.filter(
          job => formData.jobs.includes(job.id)
        );
        
        if (selectedCategoryJobs.length === 0) {
          errors[`category_${category.id}`] = 
            `You must select at least one ${category.name} job`;
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

  // Handle job selection
  const handleJobChange = (jobId: string) => {
    setFormData(prev => {
      const updatedJobs = prev.jobs.includes(jobId)
        ? prev.jobs.filter(id => id !== jobId)
        : [...prev.jobs, jobId];
      
      return {
        ...prev,
        jobs: updatedJobs
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
                    Dues: ${option.participantDues} | Required Jobs: {option.jobsRequired}
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
                    Dues: ${option.participantDues} | Required Jobs: {option.jobsRequired}
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

  // Render jobs step
  const renderJobsStep = () => {
    const requiredCount = calculateRequiredJobCount();
    const alwaysRequiredJobs = getAlwaysRequiredJobs();
    const campingOptionJobs = getCampingOptionJobs();
    const alwaysRequiredCategories = getAlwaysRequiredCategories();
    
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Work Jobs</h2>
        <p className="mb-4">
          You need to select at least {requiredCount} jobs to complete registration.
        </p>
        
        {/* Always Required Job Categories Section */}
        {alwaysRequiredCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Required Jobs</h3>
            <p className="text-sm text-gray-700 mb-4">
              These jobs are required for all participants regardless of camping options.
              You must select at least one job from each required category.
            </p>
            
            {alwaysRequiredCategories.map(category => {
              const categoryJobs = alwaysRequiredJobs.filter(
                job => job.categoryId === category.id
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
                    {categoryJobs.map(job => (
                      <div key={job.id} className="border p-3 rounded">
                        <label className="flex items-start">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={formData.jobs.includes(job.id)}
                            onChange={() => handleJobChange(job.id)}
                          />
                          <div className="ml-2">
                            <div>{job.name}</div>
                            <div className="text-sm text-gray-600">
                              {getShiftInfoForJob(job)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Spots: {job.maxRegistrations - (job.currentRegistrations || 0)} of {job.maxRegistrations} available
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                    
                    {categoryJobs.length === 0 && (
                      <div className="text-amber-600">No jobs available for this category</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Camping Option Jobs Section */}
        {campingOptionJobs.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2">Camping Option Jobs</h3>
            <p className="text-sm text-gray-700 mb-4">
              These jobs are available based on your selected camping options.
            </p>
            
            <div className="space-y-2">
              {campingOptionJobs.map(job => (
                <div key={job.id} className="border p-3 rounded">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={formData.jobs.includes(job.id)}
                      onChange={() => handleJobChange(job.id)}
                    />
                    <div className="ml-2">
                      <div>{job.name}</div>
                      <div className="text-sm text-gray-600">
                        Category: {job.categoryName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getShiftInfoForJob(job)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Spots: {job.maxRegistrations - (job.currentRegistrations || 0)} of {job.maxRegistrations} available
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {formErrors.jobs && (
          <div className="text-red-600 mt-2">{formErrors.jobs}</div>
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
          <h3 className="text-lg font-medium mb-2">Selected Jobs</h3>
          <ul className="list-disc pl-5">
            {formData.jobs.map(jobId => {
              const job = jobs.find(j => j.id === jobId);
              return job ? (
                <li key={jobId}>
                  {job.name} | {getShiftInfoForJob(job)}
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
        return renderJobsStep();
      case 3:
        return renderTermsStep();
      default:
        return null;
    }
  };

  // Helper function to get shift info for a job
  const getShiftInfoForJob = (job: Job): string => {
    const shift = shifts.find(s => s.id === job.shiftId);
    if (!shift) return 'Unknown shift';
    
    return `${shift.dayOfWeek} | ${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`;
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
              {step === 2 && 'Work Jobs'}
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
