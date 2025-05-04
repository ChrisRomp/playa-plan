import React, { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { CoreConfiguration, Registration } from '../../types/api';
import RichTextContent from '../../components/common/RichTextContent';

export const Home: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [config, setConfig] = useState<CoreConfiguration | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const configData = await apiClient.getCoreConfiguration();
        setConfig(configData);
        
        if (isAuthenticated) {
          const registrationData = await apiClient.getCurrentRegistration();
          setRegistration(registrationData);
        }
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const renderAnonymousUserContent = () => {
    return (
      <div className="mt-6 flex justify-center">
        <Button 
          size="lg"
          onClick={() => window.location.href = '/login'}
        >
          Sign In or Register
        </Button>
      </div>
    );
  };
  
  const renderAuthenticatedUserContent = () => {
    // Early return if config is not loaded
    if (!config) return null;

    // Check if registration is open for this user
    const userHasEarlyAccess = false; // This would come from the user's profile
    const registrationOpenForUser = 
      config.isRegistrationOpen || 
      (config.isEarlyRegistrationOpen && userHasEarlyAccess);
      
    if (!registrationOpenForUser) {
      return (
        <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-800">Registration Not Yet Open</h2>
          <p className="mt-2">
            Registration for this year's camp is not yet open. Please check back later.
          </p>
        </div>
      );
    }
    
    if (!registration) {
      return (
        <div className="mt-6 text-center">
          <p className="mb-4">Registration is now open! Sign up for this year's camp.</p>
          <Button 
            size="lg" 
            variant="primary"
            onClick={() => window.location.href = '/registration'}
          >
            Register for Camp
          </Button>
        </div>
      );
    }
    
    // User has already registered
    return (
      <div className="mt-6">
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <h2 className="text-xl font-semibold text-green-800">
            You're Registered!
          </h2>
          <div className="mt-4 space-y-4">
            <p>
              Your registration for this year's camp is complete. Here's a summary of your registration:
            </p>
            
            {/* Registration summary */}
            <div className="bg-white p-4 rounded shadow-sm">
              <p className="font-medium">Camping Option: {registration.campingOption}</p>
              {registration.arrivalDate && registration.departureDate && (
                <p>
                  Dates: {new Date(registration.arrivalDate).toLocaleDateString()} to{' '}
                  {new Date(registration.departureDate).toLocaleDateString()}
                </p>
              )}
              <p>Payment Status: {registration.paymentStatus}</p>
            </div>
            
            <h3 className="text-lg font-medium text-gray-800">Your Work Shifts</h3>
            <div className="bg-white p-4 rounded shadow-sm">
              <p className="font-medium">Work shift details will appear here</p>
              {/* This would be populated with actual shift data */}
            </div>
            
            <div className="mt-4">
              <Button
                onClick={() => window.location.href = '/user/registration'}
              >
                View Full Registration Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (error || !config) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-600">{error || 'Failed to load application data.'}</p>
      </div>
    );
  }

  return (
    <Layout
      campName={config.campName}
      campDescription={config.campDescription}
      bannerUrl={config.campBannerUrl}
      iconUrl={config.campIconUrl}
      bannerAltText={config.campBannerAltText}
      iconAltText={config.campIconAltText}
      isAuthenticated={isAuthenticated}
      userRole={user?.role}
    >
      <div className="max-w-3xl mx-auto">
        <div className="prose prose-blue mx-auto">
          {/* Render HTML from API safely */}
          <RichTextContent html={config.homePageBlurb} />
        </div>
        
        {isAuthenticated ? renderAuthenticatedUserContent() : renderAnonymousUserContent()}
      </div>
    </Layout>
  );
};

export default Home; 