import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegistration, RegistrationFormData } from '../../hooks/useRegistration';
import { useCampingOptions } from '../../hooks/useCampingOptions';
import { useProfile } from '../../hooks/useProfile';
import { AuthContext } from '../../store/authUtils';
import { JobCategory, Job, CampingOptionField } from '../../lib/api';

/**
 * RegistrationPage component for user camp registration
 * Implements a multi-step registration flow:
 * 1. Profile confirmation
 * 2. Camping option selection
 * 3. Custom fields based on camping option
 * 4. Job/shift selection
 * 5. Terms acceptance
 * 6. Payment and confirmation
 */
export default function RegistrationPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { profile, updateProfile, error: profileError } = useProfile();
  const {
    campingOptions,
    jobCategories,
    jobs,
    shifts,
    loading: registrationLoading,
    error: registrationError,
    fetchCampingOptions,
    fetchJobCategories,
    fetchShifts,
    fetchJobs,
    submitRegistration,
  } = useRegistration();
  
  const {
    loadCampingOptionFields
  } = useCampingOptions();

  // Form state
  const [formData, setFormData] = useState<RegistrationFormData>({
    campingOptions: [],
    customFields: {},
    jobs: [],
    acceptedTerms: false,
  });
  
  // Multi-step form control
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Profile form state
  const [profileFormData, setProfileFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
    stateProvince: profile?.stateProvince || '',
    country: profile?.country || '',
    playaName: profile?.playaName || '',
    emergencyContact: profile?.emergencyContact || '',
  });
  
  // Update profile form data when profile changes
  useEffect(() => {
    if (profile) {
      setProfileFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        city: profile.city || '',
        stateProvince: profile.stateProvince || '',
        country: profile.country || '',
        playaName: profile.playaName || '',
        emergencyContact: profile.emergencyContact || '',
      });
    }
  }, [profile]);
  
  // Track loaded custom fields for selected camping options
  const [customFieldsByOption, setCustomFieldsByOption] = useState<Record<string, CampingOptionField[]>>({});

  // Fetch initial data on component mount
  useEffect(() => {
    fetchCampingOptions();
    fetchJobCategories();
    fetchShifts();
  }, [fetchCampingOptions, fetchJobCategories, fetchShifts]);

  // When camping options change, fetch jobs and custom fields
  useEffect(() => {
    // Only fetch jobs if we have job categories loaded and either have selected camping options 
    // or there are always required categories
    if (jobCategories.length > 0 && (formData.campingOptions.length > 0 || hasAlwaysRequiredCategories(jobCategories))) {
      fetchJobs(formData.campingOptions);
    }
  }, [formData.campingOptions, jobCategories, fetchJobs]);

  // Load custom fields for selected camping options
  useEffect(() => {
    formData.campingOptions.forEach(optionId => {
      // Only load if we don't already have fields for this option
      if (!customFieldsByOption[optionId]) {
        loadCampingOptionFields(optionId).then(fields => {
          setCustomFieldsByOption(prev => ({
            ...prev,
            [optionId]: fields
          }));
        });
      }
    });
  }, [formData.campingOptions, customFieldsByOption, loadCampingOptionFields]);

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
      (total, option) => total + option.shiftsRequired, 
      0
    );
    
    // Every always required category adds at least one required job
    const alwaysRequiredCount = getAlwaysRequiredCategories().length;
    
    return campingJobsRequired + alwaysRequiredCount;
  };

  // Get all custom fields for selected camping options
  const getAllCustomFields = (): CampingOptionField[] => {
    const allFields: CampingOptionField[] = [];
    
    formData.campingOptions.forEach(optionId => {
      if (customFieldsByOption[optionId]) {
        allFields.push(...customFieldsByOption[optionId]);
      }
    });
    
    return allFields;
  };

  // Validate the current step
  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (currentStep === 1) {
      // Validate profile form fields
      const requiredFields = ['firstName', 'lastName', 'phone', 'emergencyContact'];
      const missingFields = requiredFields.filter(field => !profileFormData[field as keyof typeof profileFormData]);
      
      if (missingFields.length > 0) {
        missingFields.forEach(field => {
          errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        });
      }
    }
    else if (currentStep === 2) {
      // Validate camping options selection
      if (formData.campingOptions.length === 0) {
        errors.campingOptions = 'Please select at least one camping option';
      }
    } 
    else if (currentStep === 3) {
      // Validate custom fields
      const customFields = getAllCustomFields();
      
      customFields.forEach(field => {
        const value = formData.customFields[field.id];
        
        if (field.required && (value === undefined || value === '')) {
          errors[`field_${field.id}`] = `${field.displayName} is required`;
        }
        
        if (value !== undefined && value !== '') {
          // Type-specific validations
          switch (field.dataType) {
            case 'STRING':
            case 'MULTILINE_STRING': {
              if (typeof value === 'string' && field.maxLength && value.length > field.maxLength) {
                errors[`field_${field.id}`] = `${field.displayName} must be less than ${field.maxLength} characters`;
              }
              break;
            }
            
            case 'INTEGER':
            case 'NUMBER': {
              const numValue = Number(value);
              if (field.minValue !== null && numValue < field.minValue!) {
                errors[`field_${field.id}`] = `${field.displayName} must be at least ${field.minValue}`;
              }
              if (field.maxValue !== null && numValue > field.maxValue!) {
                errors[`field_${field.id}`] = `${field.displayName} must be at most ${field.maxValue}`;
              }
              break;
            }
          }
        }
      });
    }
    else if (currentStep === 4) {
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
    } 
    else if (currentStep === 5) {
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
    
    if (currentStep < 5) {
      // Save profile data if we're on step 1
      if (currentStep === 1) {
        const profileSaved = await handleProfileFormSubmit();
        if (!profileSaved) {
          return; // Don't proceed if profile save failed
        }
      }
      setCurrentStep(currentStep + 1);
    } else {
      try {
        await submitRegistration(formData);
        navigate('/dashboard'); // Redirect to dashboard after successful registration
      } catch (err) {
        console.error('Registration failed:', err);
        setFormErrors({ submit: 'Registration submission failed. Please try again.' });
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

  // Handle custom field input changes
  const handleCustomFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: value
      }
    }));
  };

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileFormSubmit = async (): Promise<boolean> => {
    try {
      await updateProfile({
        firstName: profileFormData.firstName,
        lastName: profileFormData.lastName,
        phone: profileFormData.phone,
        city: profileFormData.city,
        stateProvince: profileFormData.stateProvince,
        country: profileFormData.country,
        playaName: profileFormData.playaName,
        emergencyContact: profileFormData.emergencyContact,
      });
      return true;
    } catch (err) {
      console.error('Error updating profile:', err);
      return false;
    }
  };

  // Render profile confirmation step
  const renderProfileFormStep = () => {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Profile Information</h2>
        <p className="mb-4 text-gray-700">
          Please complete or verify your profile information before proceeding with registration.
        </p>
        
        {profileError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {profileError}
          </div>
        )}
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name*
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={profileFormData.firstName}
                onChange={handleProfileFormChange}
                required
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.firstName && (
                <div className="text-red-600 text-sm">{formErrors.firstName}</div>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name*
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={profileFormData.lastName}
                onChange={handleProfileFormChange}
                required
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.lastName && (
                <div className="text-red-600 text-sm">{formErrors.lastName}</div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="playaName" className="block text-sm font-medium text-gray-700">
              Playa Name
            </label>
            <input
              type="text"
              id="playaName"
              name="playaName"
              value={profileFormData.playaName}
              onChange={handleProfileFormChange}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500">If you have one</p>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email*
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={profileFormData.email}
              onChange={handleProfileFormChange}
              required
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number*
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={profileFormData.phone}
              onChange={handleProfileFormChange}
              required
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            {formErrors.phone && (
              <div className="text-red-600 text-sm">{formErrors.phone}</div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={profileFormData.city}
                onChange={handleProfileFormChange}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="stateProvince" className="block text-sm font-medium text-gray-700">
                State/Province
              </label>
              <input
                type="text"
                id="stateProvince"
                name="stateProvince"
                value={profileFormData.stateProvince}
                onChange={handleProfileFormChange}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
            
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                Country
              </label>
              <input
                type="text"
                id="country"
                name="country"
                value={profileFormData.country}
                onChange={handleProfileFormChange}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700">
              Emergency Contact(s)*
            </label>
            <textarea
              id="emergencyContact"
              name="emergencyContact"
              value={profileFormData.emergencyContact}
              onChange={handleProfileFormChange}
              required
              placeholder="Example: Jane Doe, (555) 123-4567, Sister"
              rows={3}
              maxLength={1024}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500">Please include name, phone number, and relationship to you</p>
            {formErrors.emergencyContact && (
              <div className="text-red-600 text-sm">{formErrors.emergencyContact}</div>
            )}
          </div>
        </div>
      </div>
    );
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
                  <div className="text-sm text-gray-600">{option.description}</div>
                  <div className="text-sm text-gray-600">
                    Dues: ${option.participantDues} | Required Jobs: {option.shiftsRequired}
                  </div>
                  {option.maxSignups > 0 && (
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center mt-1">
                        <span className="mr-2">Availability: </span>
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, ((option.currentSignups || 0) / option.maxSignups) * 100)}%` 
                            }}
                          />
                        </div>
                        <span className="ml-2 text-xs">
                          {option.maxSignups - (option.currentSignups || 0)} of {option.maxSignups} remaining
                        </span>
                      </div>
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
                  <div className="text-sm text-gray-600">{option.description}</div>
                  <div className="text-sm text-gray-600">
                    Dues: ${option.participantDues} | Required Jobs: {option.shiftsRequired}
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

  // Render custom fields step
  const renderCustomFieldsStep = () => {
    const allCustomFields = getAllCustomFields();
    
    if (allCustomFields.length === 0) {
      return (
        <div>
          <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
          <p>No additional information is required for your selected camping options.</p>
        </div>
      );
    }
    
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
        <p className="mb-4">
          Please provide the following information for your selected camping options.
        </p>
        
        <div className="space-y-6">
          {allCustomFields.map(field => {
            const fieldId = field.id;
            const value = formData.customFields[fieldId] || '';
            const error = formErrors[`field_${fieldId}`];
            
            return (
              <div key={fieldId} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {field.displayName}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </label>
                
                {field.description && (
                  <p className="text-xs text-gray-500">{field.description}</p>
                )}
                
                {/* Render appropriate input based on field type */}
                {field.dataType === 'STRING' && (
                  <input
                    type="text"
                    value={value as string}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    maxLength={field.maxLength || undefined}
                  />
                )}
                
                {field.dataType === 'MULTILINE_STRING' && (
                  <textarea
                    value={value as string}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    maxLength={field.maxLength || undefined}
                  />
                )}
                
                {field.dataType === 'INTEGER' && (
                  <input
                    type="number"
                    step="1"
                    value={value as string}
                    onChange={(e) => handleCustomFieldChange(fieldId, parseInt(e.target.value, 10) || '')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    min={field.minValue !== null ? field.minValue : undefined}
                    max={field.maxValue !== null ? field.maxValue : undefined}
                  />
                )}
                
                {field.dataType === 'NUMBER' && (
                  <input
                    type="number"
                    step="0.01"
                    value={value as string}
                    onChange={(e) => handleCustomFieldChange(fieldId, parseFloat(e.target.value) || '')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    min={field.minValue !== null ? field.minValue : undefined}
                    max={field.maxValue !== null ? field.maxValue : undefined}
                  />
                )}
                
                {field.dataType === 'BOOLEAN' && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => handleCustomFieldChange(fieldId, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-900">Yes</span>
                  </div>
                )}
                
                {field.dataType === 'DATE' && (
                  <input
                    type="date"
                    value={value as string}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                )}
                
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            );
          })}
        </div>
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
                        Category: {job.category ? job.category.name : 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getShiftInfoForJob(job)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Spots: {job.maxRegistrations} available
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
                <li key={optionId}>
                  {option.name} - ${user && user.role === 'staff' ? option.staffDues : option.participantDues}
                </li>
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
        return renderProfileFormStep();
      case 2:
        return renderCampingOptionsStep();
      case 3:
        return renderCustomFieldsStep();
      case 4:
        return renderJobsStep();
      case 5:
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

  // Format time string for display - extracts only the time part, ignoring the placeholder date
  const formatTime = (timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate total cost for registration
  const calculateTotalCost = (): number => {
    const isStaffOrAdmin = user && (user.role === 'staff' || user.role === 'admin');
    
    return formData.campingOptions.reduce((total, optionId) => {
      const option = campingOptions.find(o => o.id === optionId);
      if (option) {
        // Apply staff pricing for staff and admin users
        return total + (isStaffOrAdmin ? option.staffDues : option.participantDues);
      }
      return total;
    }, 0);
  };

  if (authLoading || registrationLoading && !jobs.length && !campingOptions.length) {
    return <div className="p-6">Loading registration data...</div>;
  }

  if (registrationError) {
    return <div className="p-6 text-red-600">{registrationError}</div>;
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-600">You must be logged in to register.</p>
        <button 
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Camp Registration</h1>
      
      {/* Step Progress Indicator */}
      <div className="flex mb-8">
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} className="flex-1">
            <div className={`h-2 ${step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className="mt-2 text-center text-sm">
              {step === 1 && 'Profile'}
              {step === 2 && 'Camping'}
              {step === 3 && 'Details'}
              {step === 4 && 'Jobs'}
              {step === 5 && 'Review'}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit}>
        {renderCurrentStep()}
        
        {formErrors.submit && (
          <div className="text-red-600 mt-4 p-2 bg-red-50 border border-red-200 rounded">
            {formErrors.submit}
          </div>
        )}
        
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
            {currentStep < 5 ? 'Continue' : 'Complete Registration'}
          </button>
        </div>
        
        {/* Payment amount display */}
        {currentStep === 5 && (
          <div className="mt-4 text-right">
            <div className="font-bold">Total: ${calculateTotalCost().toFixed(2)}</div>
          </div>
        )}
      </form>
    </div>
  );
}
