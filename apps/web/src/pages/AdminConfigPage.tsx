import React, { useState, useEffect } from 'react';
import { useConfig } from '../store/ConfigContext';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../routes';

/**
 * Admin Configuration Page
 * 
 * Allows administrators to configure system-wide settings
 */
const AdminConfigPage: React.FC = () => {
  const { config, refreshConfig } = useConfig();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Test email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTestEmailLoading, setIsTestEmailLoading] = useState(false);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [testEmailSuccess, setTestEmailSuccess] = useState<string | null>(null);
  const [testEmailAuditRecord, setTestEmailAuditRecord] = useState<{
    id: string;
    recipientEmail: string;
    timestamp: string;
    subject: string;
  } | null>(null);
  
  // Enhanced test email state for 6.7.3.x features
  const [testEmailSubject, setTestEmailSubject] = useState('');
  const [testEmailMessage, setTestEmailMessage] = useState('');
  const [testEmailFormat, setTestEmailFormat] = useState<'html' | 'text'>('html');
  const [includeSmtpDetails, setIncludeSmtpDetails] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{
    subject: string;
    content: string;
    format: string;
  } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    campName: '',
    campDescription: '',
    homePageBlurb: '',
    campBannerUrl: '',
    campBannerAltText: '',
    campIconUrl: '',
    campIconAltText: '',
    registrationYear: new Date().getFullYear(),
    earlyRegistrationOpen: false,
    registrationOpen: true,
    registrationTerms: '',
    allowDeferredDuesPayment: false,
    stripeEnabled: false,
    stripePublicKey: '',
    stripeApiKey: '',
    paypalEnabled: false,
    paypalClientId: '',
    paypalClientSecret: '',
    paypalMode: 'sandbox',
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpUseSsl: false,
    senderEmail: '',
    senderName: '',
    timeZone: 'UTC'
  });

  // Load current configuration data when component mounts
  useEffect(() => {
    const loadFullConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setValidationErrors([]);
        
        // Get the full config, not just the public one
        const response = await api.get('/core-config/current');
        
        if (response.data) {
          // Update form with current data
          // Note: Sensitive fields (stripeApiKey, paypalClientSecret, smtpPassword)
          // are excluded from API responses for security and should remain empty in the form unless
          // the user explicitly provides new values
          setFormData({
            campName: response.data.campName || '',
            campDescription: response.data.campDescription || '',
            homePageBlurb: response.data.homePageBlurb || '',
            campBannerUrl: response.data.campBannerUrl || '',
            campBannerAltText: response.data.campBannerAltText || '',
            campIconUrl: response.data.campIconUrl || '',
            campIconAltText: response.data.campIconAltText || '',
            registrationYear: response.data.registrationYear || new Date().getFullYear(),
            earlyRegistrationOpen: response.data.earlyRegistrationOpen || false,
            registrationOpen: response.data.registrationOpen || false,
            registrationTerms: response.data.registrationTerms || '',
            allowDeferredDuesPayment: response.data.allowDeferredDuesPayment || false,
            stripeEnabled: response.data.stripeEnabled || false,
            stripePublicKey: response.data.stripePublicKey || '',
            stripeApiKey: '', // Always empty - excluded from API response for security
            paypalEnabled: response.data.paypalEnabled || false,
            paypalClientId: response.data.paypalClientId || '',
            paypalClientSecret: '', // Always empty - excluded from API response for security
            paypalMode: response.data.paypalMode || 'sandbox',
            emailEnabled: response.data.emailEnabled || false,
            smtpHost: response.data.smtpHost || '',
            smtpPort: response.data.smtpPort || 587,
            smtpUsername: response.data.smtpUsername || '',
            smtpPassword: '', // Always empty - excluded from API response for security
            smtpUseSsl: response.data.smtpUseSsl || false,
            senderEmail: response.data.senderEmail || '',
            senderName: response.data.senderName || '',
            timeZone: response.data.timeZone || 'UTC'
          });
        }
      } catch (err) {
        console.error('Failed to load configuration:', err);
        setError('Failed to load configuration. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFullConfig();
  }, []);
  
  // Helper function to format URL fields to absolute URLs
  const formatUrlField = (url: string): string => {
    // If it's empty, return empty string
    if (!url || url.trim() === '') return '';
    
    // Just return the trimmed URL as is
    return url.trim();
  };
  
  // Validate email format
  const isValidEmail = (email: string): boolean => {
    if (!email) return true; // Empty is allowed (optional field)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle different input types
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: target.checked
      });
    } else if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseInt(value, 10)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  // Client-side validation
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    // Email validation
    if (formData.senderEmail && !isValidEmail(formData.senderEmail)) {
      errors.push('Sender Email must be a valid email address');
    }
    
    // Email configuration validation when email is enabled
    if (formData.emailEnabled) {
      if (!formData.smtpHost || formData.smtpHost.trim() === '') {
        errors.push('SMTP Host is required when email notifications are enabled');
      }
      
      if (!formData.smtpPort || formData.smtpPort <= 0 || formData.smtpPort > 65535) {
        errors.push('SMTP Port must be a valid port number (1-65535) when email notifications are enabled');
      }
      
      if (!formData.senderEmail || formData.senderEmail.trim() === '') {
        errors.push('Sender Email is required when email notifications are enabled');
      }
      
      if (!formData.senderName || formData.senderName.trim() === '') {
        errors.push('Sender Name is required when email notifications are enabled');
      }
    }
    
    return errors;
  };
  
  // Handle audit record link click
  const handleAuditRecordClick = (auditRecord: { id: string; recipientEmail: string; timestamp: string; subject: string }) => {
    // For now, show an alert with audit record details
    // In the future, this could navigate to a dedicated audit page
    const details = [
      `Audit Record ID: ${auditRecord.id}`,
      `Recipient: ${auditRecord.recipientEmail}`,
      `Subject: ${auditRecord.subject}`,
      `Timestamp: ${auditRecord.timestamp ? new Date(auditRecord.timestamp).toLocaleString() : 'Not available'}`
    ].join('\n');
    
    alert(`Email Audit Record Details:\n\n${details}`);
  };
  
  // Clear test email state
  const clearTestEmailState = () => {
    setTestEmailError(null);
    setTestEmailSuccess(null);
    setTestEmailAuditRecord(null);
  };
  
  // Generate email preview
  const generateEmailPreview = () => {
    const subject = testEmailSubject || 'Test Email from PlayaPlan';
    const message = testEmailMessage || 'This is a test email to verify your SMTP configuration is working correctly.';
    
    if (testEmailFormat === 'html') {
      const content = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #343a40;">${subject}</h1>
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 16px; margin: 24px 0;">
            <p style="color: #155724; margin: 0;">${message}</p>
          </div>
          ${includeSmtpDetails ? `
          <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #495057;">SMTP Configuration</h3>
            <p style="font-family: monospace; font-size: 14px; color: #6c757d;">
              Host: ${formData.smtpHost || 'Not configured'}<br>
              Port: ${formData.smtpPort || 'Not configured'}<br>
              Secure: ${formData.smtpUseSsl ? 'Yes (SSL/TLS)' : 'No'}<br>
              Sender: ${formData.senderName || 'Not configured'} &lt;${formData.senderEmail || 'Not configured'}&gt;
            </p>
          </div>
          ` : ''}
        </div>
      `;
      setEmailPreview({ subject, content, format: 'HTML' });
    } else {
      const content = `
${subject}

${message}

${includeSmtpDetails ? `
SMTP Configuration:
- Host: ${formData.smtpHost || 'Not configured'}
- Port: ${formData.smtpPort || 'Not configured'}
- Secure: ${formData.smtpUseSsl ? 'Yes (SSL/TLS)' : 'No'}
- Sender: ${formData.senderName || 'Not configured'} <${formData.senderEmail || 'Not configured'}>
` : ''}

This is an automated test email from PlayaPlan.
      `.trim();
      setEmailPreview({ subject, content, format: 'Plain Text' });
    }
    setShowEmailPreview(true);
  };
  
  // Quick-select button handlers for task 6.7.3.4
  const applyQuickTemplate = (templateType: 'basic' | 'detailed' | 'plain') => {
    switch (templateType) {
      case 'basic':
        setTestEmailSubject('Basic Test Email');
        setTestEmailMessage('This is a basic test to verify email delivery.');
        setTestEmailFormat('html');
        setIncludeSmtpDetails(false);
        break;
      case 'detailed':
        setTestEmailSubject('Detailed SMTP Configuration Test');
        setTestEmailMessage('This detailed test includes all SMTP configuration information for troubleshooting purposes.');
        setTestEmailFormat('html');
        setIncludeSmtpDetails(true);
        break;
      case 'plain':
        setTestEmailSubject('Plain Text Test Email');
        setTestEmailMessage('This is a plain text test email without HTML formatting.');
        setTestEmailFormat('text');
        setIncludeSmtpDetails(true);
        break;
    }
  };
  
  // Enhanced test email sending with custom content
  const handleSendTestEmail = async () => {
    // Validate email addresses (support comma-separated)
    const emails = testEmailAddress.split(',').map(e => e.trim()).filter(e => e.length > 0);
    const invalidEmails = emails.filter(email => !isValidEmail(email));
    
    if (emails.length === 0) {
      setTestEmailError('Please enter at least one email address');
      return;
    }
    
    if (invalidEmails.length > 0) {
      setTestEmailError(`Invalid email address(es): ${invalidEmails.join(', ')}`);
      return;
    }
    
    setIsTestEmailLoading(true);
    clearTestEmailState();
    
    try {
      const response = await api.post('/notifications/email/test', {
        email: testEmailAddress,
        subject: testEmailSubject || undefined,
        message: testEmailMessage || undefined,
        format: testEmailFormat,
        includeSmtpDetails: includeSmtpDetails,
      });
      
      if (response.data.success) {
        const recipientCount = emails.length;
        setTestEmailSuccess(
          `Test email sent successfully to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}!`
        );
        setTestEmailAddress(''); // Clear the input on success
        setTestEmailAuditRecord({
          id: response.data.auditRecordId || '',
          recipientEmail: emails.join(', '),
          timestamp: response.data.timestamp || new Date().toISOString(),
          subject: response.data.emailPreview?.subject || 'Test Email from PlayaPlan'
        });
      } else {
        setTestEmailError(response.data.message || 'Failed to send test email');
      }
    } catch (err) {
      console.error('Failed to send test email:', err);
      
      // Type the error properly
      interface ApiError {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
      
      const errorMessage = (err as ApiError)?.response?.data?.message || 'Failed to send test email. Please try again.';
      setTestEmailError(errorMessage);
    } finally {
      setIsTestEmailLoading(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Run client-side validation first
    const clientErrors = validateForm();
    if (clientErrors.length > 0) {
      setValidationErrors(clientErrors);
      setError('Please fix the validation errors before submitting.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setValidationErrors([]);
    setSuccess(null);
    
    // Create a copy of the form data to format URL fields
    // Exclude sensitive fields from base data as they will be conditionally added
    const baseData = {
      campName: formData.campName,
      campDescription: formData.campDescription,
      homePageBlurb: formData.homePageBlurb,
      campBannerUrl: formData.campBannerUrl ? formatUrlField(formData.campBannerUrl) : '',
      campBannerAltText: formData.campBannerAltText,
      campIconUrl: formData.campIconUrl ? formatUrlField(formData.campIconUrl) : '',
      campIconAltText: formData.campIconAltText,
      registrationYear: formData.registrationYear,
      earlyRegistrationOpen: formData.earlyRegistrationOpen,
      registrationOpen: formData.registrationOpen,
      registrationTerms: formData.registrationTerms,
      allowDeferredDuesPayment: formData.allowDeferredDuesPayment,
      stripeEnabled: formData.stripeEnabled,
      stripePublicKey: formData.stripePublicKey,
      // Note: stripeApiKey excluded - will be conditionally added below
      paypalEnabled: formData.paypalEnabled,
      paypalClientId: formData.paypalClientId,
      // Note: paypalClientSecret excluded - will be conditionally added below
      paypalMode: formData.paypalMode,
      emailEnabled: formData.emailEnabled,
      smtpHost: formData.smtpHost,
      smtpPort: formData.smtpPort,
      smtpUsername: formData.smtpUsername,
      // Note: smtpPassword excluded - will be conditionally added below
      smtpUseSsl: formData.smtpUseSsl,
      senderEmail: formData.senderEmail.trim(),
      senderName: formData.senderName,
      timeZone: formData.timeZone
    };
    
    // Only include sensitive keys if they have been provided (not empty)
    // This prevents clearing existing keys when they're not returned from the API for security
    const formattedData = {
      ...baseData,
      // Only include these fields if they have values to prevent clearing existing secrets
      ...(formData.stripeApiKey && formData.stripeApiKey.trim() !== '' && { stripeApiKey: formData.stripeApiKey }),
      ...(formData.paypalClientSecret && formData.paypalClientSecret.trim() !== '' && { paypalClientSecret: formData.paypalClientSecret }),
      ...(formData.smtpPassword && formData.smtpPassword.trim() !== '' && { smtpPassword: formData.smtpPassword })
    };

    // Debug logging to verify sensitive fields are handled correctly
    const sensitiveFields = ['stripeApiKey', 'paypalClientSecret', 'smtpPassword'];
    const includedSensitiveFields = sensitiveFields.filter(field => field in formattedData);
    console.log('Sensitive fields included in payload:', includedSensitiveFields.length > 0 ? includedSensitiveFields : 'none');
    
    try {
      // Log the formatted data for debugging
      console.log('Submitting with formatted data:', formattedData);
      
      // Determine if we need to create or update
      let response;
      if (config) {
        // Update existing config
        response = await api.patch('/core-config/current', formattedData);
      } else {
        // Create new config
        response = await api.post('/core-config', formattedData);
      }
      
      if (response.status >= 200 && response.status < 300) {
        setSuccess('Configuration saved successfully!');
        // Refresh the global config context
        await refreshConfig();
      } else {
        setError('Failed to save configuration. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Error saving configuration:', err);
      
      // Define a type for the API error response
      interface ApiErrorResponse {
        response?: {
          status?: number;
          statusText?: string;
          data?: {
            message?: string | string[];
            error?: string;
          };
        };
        message?: string;
      }
      
      // Cast the unknown error to our expected error type
      const apiError = err as ApiErrorResponse;
      
      // Extract detailed error messages from the API response
      if (apiError.response?.data) {
        if (Array.isArray(apiError.response.data.message)) {
          // Handle validation errors array
          setValidationErrors(apiError.response.data.message as string[]);
          setError('Configuration has validation errors. Please check the form and try again.');
        } else if (typeof apiError.response.data.message === 'string') {
          const errorMessage = apiError.response.data.message as string;
          setError(`Error: ${errorMessage}`);
          
          // If the error is about non-existent configuration, try to create one
          if (errorMessage.includes('not found') && config === null) {
            try {
              // Try to create a new configuration
              const createResponse = await api.post('/core-config', formattedData);
              if (createResponse.status >= 200 && createResponse.status < 300) {
                setSuccess('Configuration created successfully!');
                // Refresh the global config context
                await refreshConfig();
                // Clear the error since we recovered
                setError(null);
                setValidationErrors([]);
              }
            } catch (createErr: unknown) {
              console.error('Failed to create configuration after update error:', createErr);
              // Keep original error message if create also fails
            }
          }
        } else {
          // Generic error with status text
          setError(`Error ${apiError.response?.status || ''}: ${apiError.response?.statusText || 'An error occurred while saving the configuration.'}`);
        }
      } else if (apiError.message) {
        // Network or other error
        setError(`Error: ${apiError.message}`);
      } else {
        // Fallback error message
        setError('An error occurred while saving the configuration.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel button
  const handleCancel = () => {
    navigate(PATHS.ADMIN);
  };
  
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Site Configuration</h1>
        <button 
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Back to Admin
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {validationErrors.length > 0 && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold mb-2">Please fix the following errors:</p>
          <ul className="list-disc pl-6">
            {validationErrors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
          {/* Form sections */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Basic Camp Information</h2>
            
            <div className="mb-4">
              <label htmlFor="campName" className="block text-gray-700 font-medium mb-2">
                Camp Name*
              </label>
              <input
                type="text"
                id="campName"
                name="campName"
                value={formData.campName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="campDescription" className="block text-gray-700 font-medium mb-2">
                Camp Description (HTML allowed)
              </label>
              <textarea
                id="campDescription"
                name="campDescription"
                value={formData.campDescription}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">Brief description displayed alongside camp name.</p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="homePageBlurb" className="block text-gray-700 font-medium mb-2">
                Home Page Content (HTML allowed)
              </label>
              <textarea
                id="homePageBlurb"
                name="homePageBlurb"
                value={formData.homePageBlurb}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">Main content displayed on the home page.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label htmlFor="campBannerUrl" className="block text-gray-700 font-medium mb-2">
                  Banner Image URL
                </label>
                <input
                  type="text"
                  id="campBannerUrl"
                  name="campBannerUrl"
                  value={formData.campBannerUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL to the banner image. Both relative URLs (like /images/banner.png) and full URLs are supported.
                  <br />
                  <strong>Recommended:</strong> 1920x600px or 16:5 aspect ratio for best display across devices.
                </p>
              </div>
              
              <div className="mb-4">
                <label htmlFor="campBannerAltText" className="block text-gray-700 font-medium mb-2">
                  Banner Alt Text (for accessibility)
                </label>
                <input
                  type="text"
                  id="campBannerAltText"
                  name="campBannerAltText"
                  value={formData.campBannerAltText}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label htmlFor="campIconUrl" className="block text-gray-700 font-medium mb-2">
                  Camp Icon URL
                </label>
                <input
                  type="text"
                  id="campIconUrl"
                  name="campIconUrl"
                  value={formData.campIconUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL to the camp icon. Both relative URLs (like /icons/icon.png) and full URLs are supported.
                </p>
              </div>
              
              <div className="mb-4">
                <label htmlFor="campIconAltText" className="block text-gray-700 font-medium mb-2">
                  Icon Alt Text (for accessibility)
                </label>
                <input
                  type="text"
                  id="campIconAltText"
                  name="campIconAltText"
                  value={formData.campIconAltText}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Registration Settings</h2>
            
            <div className="mb-4">
              <label htmlFor="registrationYear" className="block text-gray-700 font-medium mb-2">
                Registration Year*
              </label>
              <input
                type="number"
                id="registrationYear"
                name="registrationYear"
                value={formData.registrationYear}
                onChange={handleInputChange}
                required
                min={2000}
                max={2100}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="registrationOpen"
                  name="registrationOpen"
                  checked={formData.registrationOpen}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="registrationOpen" className="ml-2 block text-gray-700">
                  Registration Open
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="earlyRegistrationOpen"
                  name="earlyRegistrationOpen"
                  checked={formData.earlyRegistrationOpen}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="earlyRegistrationOpen" className="ml-2 block text-gray-700">
                  Early Registration Open
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowDeferredDuesPayment"
                  name="allowDeferredDuesPayment"
                  checked={formData.allowDeferredDuesPayment}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allowDeferredDuesPayment" className="ml-2 block text-gray-700">
                  Allow Deferred Dues Payment
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="registrationTerms" className="block text-gray-700 font-medium mb-2">
                Registration Terms (HTML allowed)
              </label>
              <textarea
                id="registrationTerms"
                name="registrationTerms"
                value={formData.registrationTerms}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">Terms users must agree to during registration.</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Payment Processing</h2>
            
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="stripeEnabled"
                  name="stripeEnabled"
                  checked={formData.stripeEnabled}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="stripeEnabled" className="ml-2 block text-gray-700 font-medium">
                  Enable Stripe Payments
                </label>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!formData.stripeEnabled ? 'opacity-50' : ''}`}>
                <div className="mb-4">
                  <label htmlFor="stripePublicKey" className="block text-gray-700 mb-2">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    id="stripePublicKey"
                    name="stripePublicKey"
                    value={formData.stripePublicKey}
                    onChange={handleInputChange}
                    disabled={!formData.stripeEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="stripeApiKey" className="block text-gray-700 mb-2">
                    Stripe Secret Key
                  </label>
                  <input
                    type="password"
                    id="stripeApiKey"
                    name="stripeApiKey"
                    value={formData.stripeApiKey}
                    onChange={handleInputChange}
                    disabled={!formData.stripeEnabled}
                    placeholder={formData.stripeApiKey === '' ? 'Leave blank to keep existing key' : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave blank to keep the existing secret key. Only enter a new key if you want to change it.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="paypalEnabled"
                  name="paypalEnabled"
                  checked={formData.paypalEnabled}
                  onChange={handleInputChange}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label htmlFor="paypalEnabled" className="ml-2 block text-gray-500 font-medium">
                  Enable PayPal Payments (Not yet implemented)
                </label>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!formData.paypalEnabled ? 'opacity-50' : ''}`}>
                <div className="mb-4">
                  <label htmlFor="paypalClientId" className="block text-gray-700 mb-2">
                    PayPal Client ID
                  </label>
                  <input
                    type="text"
                    id="paypalClientId"
                    name="paypalClientId"
                    value={formData.paypalClientId}
                    onChange={handleInputChange}
                    disabled={!formData.paypalEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="paypalClientSecret" className="block text-gray-700 mb-2">
                    PayPal Client Secret
                  </label>
                  <input
                    type="password"
                    id="paypalClientSecret"
                    name="paypalClientSecret"
                    value={formData.paypalClientSecret}
                    onChange={handleInputChange}
                    disabled={!formData.paypalEnabled}
                    placeholder={formData.paypalClientSecret === '' ? 'Leave blank to keep existing secret' : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave blank to keep the existing client secret. Only enter a new secret if you want to change it.
                  </p>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="paypalMode" className="block text-gray-700 mb-2">
                    PayPal Mode
                  </label>
                  <select
                    id="paypalMode"
                    name="paypalMode"
                    value={formData.paypalMode}
                    onChange={handleInputChange}
                    disabled={!formData.paypalEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Email Configuration</h2>
            
            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="emailEnabled"
                name="emailEnabled"
                checked={formData.emailEnabled}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="emailEnabled" className="ml-2 block text-gray-700 font-medium">
                Enable Email Notifications
              </label>
            </div>
            
            <div className={`${!formData.emailEnabled ? 'opacity-50' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label htmlFor="smtpHost" className="block text-gray-700 font-medium mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    id="smtpHost"
                    name="smtpHost"
                    value={formData.smtpHost}
                    onChange={handleInputChange}
                    disabled={!formData.emailEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="smtpPort" className="block text-gray-700 font-medium mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    id="smtpPort"
                    name="smtpPort"
                    value={formData.smtpPort}
                    onChange={handleInputChange}
                    min={1}
                    max={65535}
                    disabled={!formData.emailEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label htmlFor="smtpUsername" className="block text-gray-700 font-medium mb-2">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    id="smtpUsername"
                    name="smtpUsername"
                    value={formData.smtpUsername}
                    onChange={handleInputChange}
                    disabled={!formData.emailEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="smtpPassword" className="block text-gray-700 font-medium mb-2">
                    SMTP Password
                  </label>
                  <input
                    type="password"
                    id="smtpPassword"
                    name="smtpPassword"
                    value={formData.smtpPassword}
                    onChange={handleInputChange}
                    disabled={!formData.emailEnabled}
                    placeholder={formData.smtpPassword === '' ? 'Leave blank to keep existing password' : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave blank to keep the existing password. Only enter a new password if you want to change it.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="smtpUseSsl"
                  name="smtpUseSsl"
                  checked={formData.smtpUseSsl}
                  onChange={handleInputChange}
                  disabled={!formData.emailEnabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:cursor-not-allowed"
                />
                <label htmlFor="smtpUseSsl" className="ml-2 block text-gray-700">
                  Use SSL for SMTP
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label htmlFor="senderEmail" className="block text-gray-700 font-medium mb-2">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    id="senderEmail"
                    name="senderEmail"
                    value={formData.senderEmail}
                    onChange={handleInputChange}
                    disabled={!formData.emailEnabled}
                    className={`w-full px-3 py-2 border ${
                      formData.senderEmail && !isValidEmail(formData.senderEmail)
                        ? 'border-red-500'
                        : 'border-gray-300'
                    } rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  />
                  {formData.senderEmail && !isValidEmail(formData.senderEmail) && (
                    <p className="text-red-500 text-sm mt-1">Please enter a valid email address</p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label htmlFor="senderName" className="block text-gray-700 font-medium mb-2">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    id="senderName"
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleInputChange}
                    disabled={!formData.emailEnabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Test Email Configuration</h2>
            
            {!formData.emailEnabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Email Testing Disabled
                    </h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      Email notifications are currently disabled. Please enable email notifications above to test your configuration.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className={`${!formData.emailEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-gray-600 mb-4">
                Send a test email to verify your SMTP configuration is working correctly. 
                You can customize the content, send to multiple recipients, and preview the email before sending.
              </p>
              
              {/* Quick Template Buttons */}
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Quick Templates</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('basic')}
                    disabled={!formData.emailEnabled}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Basic Test
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('detailed')}
                    disabled={!formData.emailEnabled}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Detailed SMTP Test
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('plain')}
                    disabled={!formData.emailEnabled}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Plain Text Test
                  </button>
                </div>
              </div>
              
              {/* Advanced Options Toggle */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  disabled={!formData.emailEnabled}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                >
                  {showAdvancedOptions ? '▼' : '▶'} Advanced Options
                </button>
              </div>
              
              {/* Advanced Options Panel */}
              {showAdvancedOptions && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="testEmailSubject" className="block text-gray-700 font-medium mb-2">
                        Custom Subject
                      </label>
                      <input
                        type="text"
                        id="testEmailSubject"
                        value={testEmailSubject}
                        onChange={(e) => setTestEmailSubject(e.target.value)}
                        placeholder="Leave blank for default subject"
                        disabled={!formData.emailEnabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="testEmailFormat" className="block text-gray-700 font-medium mb-2">
                        Email Format
                      </label>
                      <select
                        id="testEmailFormat"
                        value={testEmailFormat}
                        onChange={(e) => setTestEmailFormat(e.target.value as 'html' | 'text')}
                        disabled={!formData.emailEnabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="html">HTML Format</option>
                        <option value="text">Plain Text</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="testEmailMessage" className="block text-gray-700 font-medium mb-2">
                      Custom Message Content
                    </label>
                    <textarea
                      id="testEmailMessage"
                      value={testEmailMessage}
                      onChange={(e) => setTestEmailMessage(e.target.value)}
                      placeholder="Leave blank for default test message"
                      rows={3}
                      disabled={!formData.emailEnabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="includeSmtpDetails"
                        checked={includeSmtpDetails}
                        onChange={(e) => setIncludeSmtpDetails(e.target.checked)}
                        disabled={!formData.emailEnabled}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:cursor-not-allowed"
                      />
                      <label htmlFor="includeSmtpDetails" className="ml-2 block text-gray-700">
                        Include SMTP Configuration Details in Email
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Email Address and Actions */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                <div className="md:col-span-2">
                  <label htmlFor="testEmailAddress" className="block text-gray-700 font-medium mb-2">
                    Email Address(es)
                  </label>
                  <input
                    type="text"
                    id="testEmailAddress"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="email@example.com or email1@example.com, email2@example.com"
                    disabled={!formData.emailEnabled || isTestEmailLoading}
                    className={`w-full px-3 py-2 border ${
                      testEmailAddress && testEmailAddress.split(',').some(email => !isValidEmail(email.trim()))
                        ? 'border-red-500'
                        : 'border-gray-300'
                    } rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Separate multiple emails with commas
                  </p>
                </div>
                
                <div>
                  <button
                    type="button"
                    onClick={generateEmailPreview}
                    disabled={!formData.emailEnabled || !testEmailAddress}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Preview Email
                  </button>
                </div>
                
                <div>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={!formData.emailEnabled || isTestEmailLoading || !testEmailAddress}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isTestEmailLoading ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
              </div>
              
              {/* Email Preview Modal */}
              {showEmailPreview && emailPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Email Preview - {emailPreview.format}</h3>
                      <button
                        onClick={() => setShowEmailPreview(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                      <div className="mb-4">
                        <strong>Subject:</strong> {emailPreview.subject}
                      </div>
                      <div className="border border-gray-200 rounded p-4 bg-gray-50">
                        {emailPreview.format === 'HTML' ? (
                          <div dangerouslySetInnerHTML={{ __html: emailPreview.content }} />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{emailPreview.content}</pre>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                      <button
                        onClick={() => setShowEmailPreview(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Error and Success Messages */}
              {testEmailError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Test Email Failed
                      </h3>
                      <p className="mt-1 text-sm text-red-700">
                        {testEmailError}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {testEmailSuccess && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-medium text-green-800">
                        Test Email Sent Successfully
                      </h3>
                      <p className="mt-1 text-sm text-green-700">
                        {testEmailSuccess}
                      </p>
                      {testEmailAuditRecord && testEmailAuditRecord.id && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="text-xs text-green-600">
                            Audit Record: 
                            <button
                              type="button"
                              onClick={() => handleAuditRecordClick(testEmailAuditRecord)}
                              className="ml-1 text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            >
                              {testEmailAuditRecord.id}
                            </button>
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Sent at: {new Date(testEmailAuditRecord.timestamp).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">System Settings</h2>
            
            <div className="mb-4">
              <label htmlFor="timeZone" className="block text-gray-700 font-medium mb-2">
                Time Zone
              </label>
              <select
                id="timeZone"
                name="timeZone"
                value={formData.timeZone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
                {/* Add more time zones as needed */}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminConfigPage;