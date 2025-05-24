import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/authUtils';
import { useProfile } from '../hooks/useProfile';
import { useCampRegistration } from '../hooks/useCampRegistration';
import { getFriendlyDayName, formatTime } from '../utils/shiftUtils';
import { PATHS } from '../routes';

/**
 * Dashboard page component
 * Displays user dashboard with current registrations and work shifts
 */
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isProfileComplete } = useProfile();
  const { campRegistration, loading, error } = useCampRegistration();
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {!isProfileComplete && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                Please{' '}
                <Link to={PATHS.PROFILE} className="underline hover:text-amber-800">
                  complete your profile
                </Link>
                {' '}to access all features.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome,{' '}
            {(profile?.playaName && profile.playaName.trim() !== '') 
              ? profile.playaName 
              : (user?.name || 'Camper')}
            !
          </h2>
          
          {/* Current Registrations Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Registration</h3>
            
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading registration...</span>
              </div>
            )}
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{error}</p>
              </div>
            )}
            
            {!loading && !error && !campRegistration?.hasRegistration && (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600 mb-4">You haven't registered for camp yet.</p>
                <Link 
                  to={PATHS.REGISTRATION} 
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Start Registration
                </Link>
              </div>
            )}
            
            {!loading && !error && campRegistration?.hasRegistration && (
              <div className="space-y-6">
                {/* Camping Options Section */}
                {campRegistration.campingOptions.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Camping</h4>
                    <div className="space-y-2">
                      {campRegistration.campingOptions.map((campingOptionReg) => (
                        <div key={campingOptionReg.id} className="bg-white rounded p-3 border border-blue-100">
                          <h5 className="font-medium text-gray-900">{campingOptionReg.campingOption?.name}</h5>
                          {campingOptionReg.campingOption?.description && (
                            <p className="text-sm text-gray-600 mt-1">{campingOptionReg.campingOption.description}</p>
                          )}
                          
                          {/* Custom field values for this camping option */}
                          {campRegistration.customFieldValues.some(fv => 
                            campingOptionReg.campingOption?.fields?.some(f => f.id === fv.fieldId)
                          ) && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <h6 className="text-xs font-medium text-gray-700 mb-1">Additional Information:</h6>
                              <div className="space-y-1">
                                {campRegistration.customFieldValues
                                  .filter(fv => campingOptionReg.campingOption?.fields?.some(f => f.id === fv.fieldId))
                                  .map((fieldValue) => (
                                    <div key={fieldValue.id} className="text-xs text-gray-600">
                                      <span className="font-medium">{fieldValue.field.displayName}:</span> {fieldValue.value}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work Shifts Section */}
                {campRegistration.jobRegistrations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Work Shifts</h4>
                    <div className="space-y-4">
                      {campRegistration.jobRegistrations.map((registration) => (
                        <div key={registration.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{registration.job?.name}</h5>
                              <p className="text-sm text-gray-600">{registration.job?.description}</p>
                              <p className="text-sm text-gray-500">
                                {registration.job?.location && `Location: ${registration.job.location}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                registration.status === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                                registration.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                registration.status === 'WAITLISTED' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {registration.status}
                              </span>
                            </div>
                          </div>
                          
                          {registration.job?.shift && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <h6 className="font-medium text-sm text-gray-700 mb-2">Shift Details</h6>
                              <div className="text-sm text-gray-600">
                                <p>
                                  <strong>Day:</strong> {getFriendlyDayName(registration.job.shift.dayOfWeek)}
                                </p>
                                <p>
                                  <strong>Time:</strong> {formatTime(registration.job.shift.startTime)} - {formatTime(registration.job.shift.endTime)}
                                </p>
                                {registration.job.shift.description && (
                                  <p>
                                    <strong>Description:</strong> {registration.job.shift.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
