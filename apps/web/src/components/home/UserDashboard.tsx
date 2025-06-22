import React, { useContext } from 'react';
import { AuthContext } from '../../store/authUtils';
import { useConfig } from '../../hooks/useConfig';
import { Tent, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isRegistrationAccessible, getRegistrationStatusMessage } from '../../utils/registrationUtils';
import { PATHS } from '../../routes';

/**
 * UserDashboard component displays personalized content for authenticated users
 * It shows registration status, camp information, and work shift details
 */
const UserDashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { config } = useConfig();
  
  // Guard clause against missing context data
  if (!user || !config) return null;

  const isRegistrationOpen = isRegistrationAccessible(config, user);
  const registrationStatusMessage = getRegistrationStatusMessage(config, user, user.hasRegisteredForCurrentYear);
  
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Welcome, {user.name}!</h2>
        
        <div 
          className="prose lg:prose-lg max-w-none mb-6 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_a]:cursor-pointer"
          dangerouslySetInnerHTML={{ __html: config.homePageBlurb }}
        />
        
        {/* Registration Status */}
        <section aria-labelledby="registration-status" className="mt-8 border-t pt-6">
          <h3 id="registration-status" className="text-xl font-semibold mb-4">Your {config.currentYear} Registration</h3>
          
          {!isRegistrationOpen && !user.hasRegisteredForCurrentYear && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6" role="alert" aria-live="polite">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Registration is not currently open.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {isRegistrationOpen && !user.hasRegisteredForCurrentYear && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6 shadow-md" role="region" aria-label="Registration Information">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-blue-800 mb-2">Ready to join us?</h4>
                  <p className="text-blue-700 mb-4">
                    {registrationStatusMessage}
                  </p>
                  <Link 
                    to={PATHS.REGISTRATION}
                    className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium" 
                    aria-label="Begin registration process"
                  >
                    <Tent className="mr-2" size={20} aria-hidden="true" />
                    Start Registration
                  </Link>
                </div>
                <div className="hidden md:block ml-6">
                  <Tent size={64} className="text-blue-200" aria-hidden="true" />
                </div>
              </div>
            </div>
          )}
          
          {user.hasRegisteredForCurrentYear && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-500 mr-4">
                  <Tent size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-green-800">You're registered!</h4>
                  <p className="text-green-700">Your {config.currentYear} registration is confirmed.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded border border-gray-200">
                  <h5 className="font-medium text-gray-700 mb-1">Arrival Date</h5>
                  <p>August 25, 2025</p>
                </div>
                <div className="bg-white p-4 rounded border border-gray-200">
                  <h5 className="font-medium text-gray-700 mb-1">Departure Date</h5>
                  <p>September 2, 2025</p>
                </div>
              </div>
              
              <Link to={PATHS.REGISTRATION} className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
                View/Edit Registration Details
              </Link>
            </div>
          )}
          
          {/* Work Shifts Section */}
          <section aria-labelledby="work-shifts" className="mt-8">
            <h3 id="work-shifts" className="text-xl font-semibold mb-4">Work Shifts</h3>
            
            {!user.hasRegisteredForCurrentYear ? (
              <p className="text-gray-600 italic">
                You need to register first before signing up for work shifts.
              </p>
            ) : (
              <div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <div className="p-4 border-b bg-gray-50">
                    <h4 className="font-medium">Your Scheduled Shifts</h4>
                  </div>
                  
                  <div className="p-6 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" aria-hidden="true" />
                    <p className="text-gray-600 mb-4">You haven't signed up for any shifts yet</p>
                    <Link to={PATHS.SHIFTS} className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                      Sign Up for Shifts
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
};

export default UserDashboard;