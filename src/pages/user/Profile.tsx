import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { CoreConfiguration } from '../../types/api';

export const Profile: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [config, setConfig] = useState<CoreConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    // Add more profile fields as needed
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const configData = await apiClient.getCoreConfiguration();
        setConfig(configData);
        
        // In a real app, this would fetch the user's profile data
        if (user) {
          setFormData({
            name: user.name,
            email: user.email,
          });
        }
      } catch (err) {
        setError('Failed to load profile data. Please try again later.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      // In a real app, this would update the user's profile
      console.log('Saving profile:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message or redirect
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || authLoading || !config) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p>
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
      isAuthenticated={!!user}
      userRole={user?.role}
    >
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Your Profile
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Update your personal information.
            </p>
          </div>
          
          <div className="border-t border-gray-200">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              <div className="space-y-6">
                <div>
                  <Input
                    id="name"
                    name="name"
                    label="Full name"
                    type="text"
                    required
                    fullWidth
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                
                <div>
                  <Input
                    id="email"
                    name="email"
                    label="Email address"
                    type="email"
                    required
                    fullWidth
                    value={formData.email}
                    onChange={handleChange}
                    disabled // Email can't be changed once registered
                    helperText="Email address cannot be changed. Contact support if you need to use a different email."
                  />
                </div>
                
                {/* Add more profile fields as needed */}
                
                {error && (
                  <div className="text-red-600 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="pt-5">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="mr-3"
                      onClick={() => window.history.back()}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      isLoading={isSaving}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile; 