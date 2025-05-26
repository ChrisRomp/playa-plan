import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegistration, RegistrationFormData } from '../../hooks/useRegistration';
import { useCampingOptions } from '../../hooks/useCampingOptions';
import { useProfile } from '../../hooks/useProfile';
import { useCampRegistration } from '../../hooks/useCampRegistration';
import { useConfig } from '../../store/ConfigContext';
import { AuthContext } from '../../store/authUtils';
import { JobCategory, Job, CampingOptionField } from '../../lib/api';
import { getFriendlyDayName, formatTime } from '../../utils/shiftUtils';
import { canUserRegister, getRegistrationStatusMessage } from '../../utils/registrationUtils';
import { PATHS } from '../../routes';
import PaymentButton from '../../components/payment/PaymentButton';

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
  const { config } = useConfig();
  const { profile, updateProfile, error: profileError } = useProfile();
  const { campRegistration, loading: campRegistrationLoading } = useCampRegistration();
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
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  
  // Collapsible categories state for shifts step
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
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

  // Get always required categories
  const getAlwaysRequiredCategories = useCallback((): JobCategory[] => {
    return jobCategories.filter(category => category.alwaysRequired);
  }, [jobCategories]);

  // Auto-expand categories with selected jobs or errors when on shifts step
  useEffect(() => {
    if (currentStep === 4) {
      const categoriesToExpand = new Set<string>();
      
      // Expand categories with selected jobs
      formData.jobs.forEach(jobId => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
          categoriesToExpand.add(job.categoryId);
        }
      });
      
      // Expand categories with validation errors
      Object.keys(formErrors).forEach(errorKey => {
        if (errorKey.startsWith('category_')) {
          const categoryId = errorKey.replace('category_', '');
          categoriesToExpand.add(categoryId);
        }
      });
      
      // Always expand all always-required categories by default
      const alwaysRequiredCategories = getAlwaysRequiredCategories();
      alwaysRequiredCategories.forEach(category => {
        categoriesToExpand.add(category.id);
      });
      
      // If no categories are expanded and we have categories to show, expand the first one
      if (categoriesToExpand.size === 0 && jobCategories.length > 0) {
        const firstCategory = jobCategories[0];
        if (firstCategory) {
          categoriesToExpand.add(firstCategory.id);
        }
      }
      
      setExpandedCategories(categoriesToExpand);
    }
  }, [currentStep, formData.jobs, formErrors, jobs, jobCategories, getAlwaysRequiredCategories]);
  
  // Track loaded custom fields for selected camping options
  const [customFieldsByOption, setCustomFieldsByOption] = useState<Record<string, CampingOptionField[]>>({});

  // Check if user can register and redirect if not
  useEffect(() => {
    if (!authLoading && !campRegistrationLoading && config && user) {
      const hasExistingRegistration = campRegistration?.hasRegistration || false;
      
      if (!canUserRegister(config, user, hasExistingRegistration)) {
        // User can't register, redirect to dashboard
        navigate(PATHS.DASHBOARD);
        return;
      }
    }
  }, [authLoading, campRegistrationLoading, config, user, campRegistration, navigate]);

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
      (total, option) => total + option.workShiftsRequired, 
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

  // Toggle category expansion state
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Group jobs by category
  const groupJobsByCategory = (jobList: Job[]): Record<string, { category: JobCategory; jobs: Job[] }> => {
    const grouped: Record<string, { category: JobCategory; jobs: Job[] }> = {};
    
    jobList.forEach(job => {
      const category = jobCategories.find(cat => cat.id === job.categoryId);
      if (category) {
        if (!grouped[category.id]) {
          grouped[category.id] = { category, jobs: [] };
        }
        grouped[category.id].jobs.push(job);
      }
    });
    
    return grouped;
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
        
        // For required fields, check if value is missing
        if (field.required) {
          if (field.dataType === 'INTEGER' || field.dataType === 'NUMBER') {
            // For number fields, check if value is null, undefined, or empty string
            // but allow 0 as a valid value
            if (value === undefined || value === null || value === '') {
              errors[`field_${field.id}`] = `${field.displayName} is required`;
            }
          } else {
            // For other field types, check if value is undefined or empty string
            if (value === undefined || value === '') {
              errors[`field_${field.id}`] = `${field.displayName} is required`;
            }
          }
        }
        
        // Type-specific validations (only if value is provided)
        if (value !== undefined && value !== null && value !== '') {
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
              if (!isNaN(numValue)) {
                if (field.minValue !== null && numValue < field.minValue!) {
                  errors[`field_${field.id}`] = `${field.displayName} must be at least ${field.minValue}`;
                }
                if (field.maxValue !== null && numValue > field.maxValue!) {
                  errors[`field_${field.id}`] = `${field.displayName} must be at most ${field.maxValue}`;
                }
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
        errors.jobs = `You need to select at least ${requiredCount} shifts`;
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
            `You must select at least one ${category.name} shift`;
        }
      });
      
      // Ensure camping option job requirements are met
      const selectedOptions = campingOptions.filter(option => 
        formData.campingOptions.includes(option.id)
      );
      
      const campingJobsRequired = selectedOptions.reduce(
        (total, option) => total + option.workShiftsRequired, 
        0
      );
      
      if (campingJobsRequired > 0) {
        const campingOptionJobs = getCampingOptionJobs();
        const selectedCampingJobs = campingOptionJobs.filter(
          job => formData.jobs.includes(job.id)
        );
        
        if (selectedCampingJobs.length < campingJobsRequired) {
          // Create a detailed error message showing each camping option's requirements
          const optionMessages = selectedOptions
            .filter(option => option.workShiftsRequired > 0)
            .map(option => {
              const shiftText = option.workShiftsRequired === 1 ? 'work shift' : 'work shifts';
              return `${option.workShiftsRequired} ${option.name} ${shiftText}`;
            });
          
          if (optionMessages.length === 1) {
            errors.campingJobs = `You must select at least ${optionMessages[0]}`;
          } else {
            const lastOption = optionMessages.pop();
            errors.campingJobs = `You must select at least ${optionMessages.join(', ')} and ${lastOption}`;
          }
        }
      }
    } 
    else if (currentStep === 5) {
      // Validate terms acceptance
      if (!formData.acceptedTerms) {
        errors.acceptedTerms = 'You must accept the terms to continue';
      }
    }
    // No validation needed for step 6 (payment) as it's handled by the payment component
    
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
    } else if (currentStep === 5) {
      // Terms step - create registration and move to payment step
      try {
        const result = await submitRegistration(formData);
        
        if (result?.jobRegistration?.id) {
          setRegistrationId(result.jobRegistration.id);
        }
        
        const totalCost = calculateTotalCost();
        const needsPayment = totalCost > 0 && (!config?.allowDeferredDuesPayment || !user?.allowDeferredDuesPayment);
        
        if (!needsPayment) {
          // No payment needed, redirect to dashboard
          navigate('/dashboard');
        } else {
          // Payment needed, move to payment step
          setCurrentStep(6);
        }
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
      option.enabled && (option.maxSignups === 0 || (option.currentRegistrations || 0) < option.maxSignups)
    );
    
    const fullOptions = campingOptions.filter(option => 
      option.enabled && option.maxSignups > 0 && (option.currentRegistrations || 0) >= option.maxSignups
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
                    Dues: ${option.participantDues} | Work Shifts: {option.workShiftsRequired}
                  </div>
                  {option.maxSignups > 0 && (
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center mt-1">
                        <span className="mr-2">Availability: </span>
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, ((option.currentRegistrations || 0) / option.maxSignups) * 100)}%` 
                            }}
                          />
                        </div>
                        <span className="ml-2 text-xs">
                          {option.maxSignups - (option.currentRegistrations || 0)} of {option.maxSignups} remaining
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
                    Dues: ${option.participantDues} | Work Shifts: {option.workShiftsRequired}
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
        
        <div className="space-y-4">
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
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    maxLength={field.maxLength || undefined}
                  />
                )}
                
                {field.dataType === 'MULTILINE_STRING' && (
                  <textarea
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    maxLength={field.maxLength || undefined}
                  />
                )}
                
                {field.dataType === 'INTEGER' && (
                  <input
                    type="number"
                    step="1"
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleCustomFieldChange(fieldId, '');
                      } else {
                        const parsed = parseInt(val, 10);
                        handleCustomFieldChange(fieldId, isNaN(parsed) ? '' : parsed);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={field.minValue !== null ? field.minValue : undefined}
                    max={field.maxValue !== null ? field.maxValue : undefined}
                  />
                )}
                
                {field.dataType === 'NUMBER' && (
                  <input
                    type="number"
                    step="0.01"
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleCustomFieldChange(fieldId, '');
                      } else {
                        const parsed = parseFloat(val);
                        handleCustomFieldChange(fieldId, isNaN(parsed) ? '' : parsed);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => handleCustomFieldChange(fieldId, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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

  // Helper component to render a collapsible job category section
  const renderJobCategorySection = (
    categoryId: string,
    categoryName: string,
    categoryDescription: string,
    jobs: Job[],
    isRequired: boolean = false,
    errorKey?: string
  ) => {
    const isExpanded = expandedCategories.has(categoryId);
    const hasError = errorKey && formErrors[errorKey];
    
    return (
      <div key={categoryId} className="mb-4 border rounded-lg">
        <button
          type="button"
          onClick={() => toggleCategoryExpansion(categoryId)}
          className={`w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 rounded-lg transition-colors ${
            hasError ? 'border-red-300 bg-red-50' : ''
          }`}
        >
          <div className="flex-1">
            <div className="flex items-center">
              <h4 className={`font-medium ${hasError ? 'text-red-800' : ''}`}>
                {categoryName}
                {isRequired && <span className="text-red-600 ml-1">*</span>}
              </h4>
              <span className="ml-2 text-sm text-gray-500">
                ({jobs.length} shift{jobs.length !== 1 ? 's' : ''})
              </span>
            </div>
            {categoryDescription && (
              <p className={`text-sm mt-1 ${hasError ? 'text-red-700' : 'text-gray-600'}`}>
                {categoryDescription}
              </p>
            )}
          </div>
          <div className="ml-4">
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        {hasError && (
          <div className="px-4 pb-2 text-red-600 text-sm">{formErrors[errorKey!]}</div>
        )}
        
        {isExpanded && (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="border p-3 rounded bg-white">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={formData.jobs.includes(job.id)}
                      onChange={() => handleJobChange(job.id)}
                    />
                    <div className="ml-2">
                      <div className="font-medium">{job.name}</div>
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
              
              {jobs.length === 0 && (
                <div className="text-amber-600 p-3 bg-amber-50 rounded">
                  No shifts available for this category
                </div>
              )}
            </div>
          </div>
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
    
    // Group camping option jobs by category
    const groupedCampingJobs = groupJobsByCategory(campingOptionJobs);
    
    // Calculate required shifts for camping options
    const selectedOptions = campingOptions.filter(option => 
      formData.campingOptions.includes(option.id)
    );
    const campingShiftsRequired = selectedOptions.reduce(
      (total, option) => total + option.workShiftsRequired, 
      0
    );
    
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Work Shifts</h2>
        <p className="mb-4">
          You need to select at least {requiredCount} shifts to complete registration.
        </p>
        
        {/* Camp Shifts Section */}
        {Object.keys(groupedCampingJobs).length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">
              Camp Shifts{campingShiftsRequired > 0 ? `: ${campingShiftsRequired} required` : ''}
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Please select work shifts for camp.
            </p>
            
            {formErrors.campingJobs && (
              <div className="text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded">
                {formErrors.campingJobs}
              </div>
            )}
            
            <div className="space-y-2">
              {Object.values(groupedCampingJobs).map(({ category, jobs }) =>
                renderJobCategorySection(
                  category.id,
                  category.name,
                  category.description || '',
                  jobs,
                  false
                )
              )}
            </div>
          </div>
        )}
        
        {/* Always Required Job Categories Section */}
        {alwaysRequiredCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">
              Additional Shifts{alwaysRequiredCategories.length > 0 ? `: ${alwaysRequiredCategories.length} required` : ''}
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              These shifts are required for all participants regardless of camping options.
              You must select at least one shift from each required category.
            </p>
            
            <div className="space-y-2">
              {alwaysRequiredCategories.map(category => {
                const categoryJobs = alwaysRequiredJobs.filter(
                  job => job.categoryId === category.id
                );
                const errorKey = `category_${category.id}`;
                
                return renderJobCategorySection(
                  category.id,
                  category.name,
                  category.description || '',
                  categoryJobs,
                  true,
                  errorKey
                );
              })}
            </div>
          </div>
        )}
        
        {formErrors.jobs && (
          <div className="text-red-600 mt-2 p-3 bg-red-50 border border-red-200 rounded">
            {formErrors.jobs}
          </div>
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
          <h3 className="text-lg font-medium mb-2">Selected Shifts</h3>
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

  // Render payment step
  const renderPaymentStep = () => {
    const totalCost = calculateTotalCost();
    const needsPayment = totalCost > 0 && (!config?.allowDeferredDuesPayment || !user?.allowDeferredDuesPayment);

    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Payment</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Registration Summary</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Dues:</span>
                <span className="font-medium">${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {needsPayment ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Please complete your payment to finalize your registration.
            </p>
            
            <PaymentButton
              amount={totalCost}
              registrationId={registrationId || undefined}
              description={`${config?.name || 'Camp'} Dues Payment ${config?.currentYear || new Date().getFullYear()}`}
              onPaymentStart={() => {
                console.log('Payment started with registrationId:', registrationId);
              }}
              onPaymentError={(error) => {
                setFormErrors(prev => ({ ...prev, payment: error }));
              }}
              className="w-full"
            >
              Complete Registration - ${totalCost.toFixed(2)}
            </PaymentButton>

            {formErrors.payment && (
              <div className="text-red-600 text-sm mt-2">
                {formErrors.payment}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">
                {totalCost === 0 
                  ? 'No payment required for your selected options.'
                  : 'Payment has been deferred. You can complete payment later.'
                }
              </p>
            </div>
            
            <button
              type="button"
              onClick={async () => {
                // Complete registration without payment
                try {
                  // If registration doesn't exist yet, create it
                  if (!registrationId) {
                    const result = await submitRegistration(formData);
                    if (result?.jobRegistration?.id) {
                      setRegistrationId(result.jobRegistration.id);
                    }
                  }
                  navigate('/dashboard');
                } catch (err) {
                  console.error('Registration completion failed:', err);
                  setFormErrors(prev => ({ ...prev, payment: 'Failed to complete registration. Please try again.' }));
                }
              }}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {totalCost === 0 ? 'Complete Registration' : 'Pay Dues Later'}
            </button>
          </div>
        )}
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
      case 6:
        return renderPaymentStep();
      default:
        return null;
    }
  };

  // Helper function to get shift info for a job
  const getShiftInfoForJob = (job: Job): string => {
    const shift = shifts.find(s => s.id === job.shiftId);
    if (!shift) return 'Unknown shift';
    
    return `${getFriendlyDayName(shift.dayOfWeek)} | ${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`;
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

  // Show loading state while checking registration status
  if (authLoading || campRegistrationLoading || (registrationLoading && !jobs.length && !campingOptions.length)) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg text-gray-600">Loading registration...</span>
        </div>
      </div>
    );
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
    );
  }

  // Show message if user can't register
  if (config && user && campRegistration !== null) {
    const hasExistingRegistration = campRegistration?.hasRegistration || false;
    
    if (!canUserRegister(config, user, hasExistingRegistration)) {
      return (
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Registration Not Available</h2>
            <p className="text-yellow-700 mb-4">{getRegistrationStatusMessage(config, user, hasExistingRegistration)}</p>
            <button 
              onClick={() => navigate(PATHS.DASHBOARD)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Camp Registration</h1>
      
      {/* Step Progress Indicator */}
      <div className="flex mb-8">
        {[1, 2, 3, 4, 5, 6].map(step => (
          <div key={step} className="flex-1">
            <div className={`h-2 ${step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className="mt-2 text-center text-sm">
              {step === 1 && 'Profile'}
              {step === 2 && 'Options'}
              {step === 3 && 'Details'}
              {step === 4 && 'Shifts'}
              {step === 5 && 'Review'}
              {step === 6 && 'Payment'}
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
        
        {/* Show job validation errors at bottom for step 4 (jobs step) */}
        {currentStep === 4 && Object.keys(formErrors).some(key => 
          key === 'jobs' || key === 'campingJobs' || key.startsWith('category_')
        ) && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800 mb-2">Please fix the following issues:</h4>
            <div className="space-y-1">
              {formErrors.jobs && (
                <div className="text-red-600">{formErrors.jobs}</div>
              )}
              {formErrors.campingJobs && (
                <div className="text-red-600">{formErrors.campingJobs}</div>
              )}
              {Object.entries(formErrors)
                .filter(([key]) => key.startsWith('category_'))
                .map(([key, error]) => (
                  <div key={key} className="text-red-600">{error}</div>
                ))
              }
            </div>
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
          
          {/* Only show form submit button if not on payment step, or if on payment step but no payment needed */}
          {currentStep !== 6 && (
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {currentStep < 5 ? 'Continue' : currentStep === 5 ? 'Review & Pay' : 'Complete Registration'}
            </button>
          )}
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
