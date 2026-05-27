import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/authUtils';
import { useProfile } from '../hooks/useProfile';
import { useUserRegistrations } from '../hooks/useUserRegistrations';
import { useCampRegistration } from '../hooks/useCampRegistration';
import { useConfig } from '../hooks/useConfig';
import { useApplications } from '../hooks/useApplications';
import { getFriendlyDayName, formatTime } from '../utils/shiftUtils';
import { isRegistrationAccessible, getRegistrationStatusMessage, getActiveRegistrations, formatRegistrationStatus } from '../utils/registrationUtils';
import { PATHS } from '../routes';
import PaymentButton from '../components/payment/PaymentButton';

/**
 * Dashboard page component
 * Displays user dashboard with current registrations and work shifts
 */
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isProfileComplete } = useProfile();
  const { config, isLoading: configLoading } = useConfig();
  const { registrations, loading: registrationsLoading, error: registrationsError } = useUserRegistrations();
  const { campRegistration, loading: campLoading, error: campError } = useCampRegistration();
  const { fetchApplications, total: pendingApplicationsCount } = useApplications();
  const [pendingCountLoaded, setPendingCountLoaded] = useState(false);

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

  useEffect(() => {
    if (isStaffOrAdmin && config?.applicationApprovalRequired) {
      fetchApplications({ status: 'APPLICATION_SUBMITTED', year: config.currentYear, limit: 1 }).then(() => {
        setPendingCountLoaded(true);
      });
    }
  }, [isStaffOrAdmin, config?.applicationApprovalRequired, config?.currentYear, fetchApplications]);
  
  // Show loading state while config is loading
  if (configLoading || !config) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Get current year registrations
  const currentYear = config?.currentYear || new Date().getFullYear();
  const currentYearRegistrations = registrations?.filter(reg => reg.year === currentYear) || [];
  const activeCurrentRegistrations = getActiveRegistrations(currentYearRegistrations);
  const currentRegistration = activeCurrentRegistrations[0]; // Get the most recent active registration
  
  // Build registration history: all registrations except the current active one, sorted by year desc then date desc
  const registrationHistory = (registrations || [])
    .filter(reg => reg.id !== currentRegistration?.id)
    .sort((a, b) => b.year !== a.year ? b.year - a.year : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Check registration access status
  const hasActiveRegistration = activeCurrentRegistrations.length > 0;
  const canAccessRegistration = isRegistrationAccessible(config, user);
  const registrationStatusMessage = getRegistrationStatusMessage(config, user, hasActiveRegistration);
  
  return (
    <div className="max-w-4xl mx-auto">
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

      {isStaffOrAdmin && config?.applicationApprovalRequired && pendingCountLoaded && pendingApplicationsCount > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              There {pendingApplicationsCount === 1 ? 'is' : 'are'}{' '}
              <span className="font-semibold">{pendingApplicationsCount}</span>{' '}
              pending application{pendingApplicationsCount !== 1 ? 's' : ''} awaiting review.
            </p>
            <Link
              to={PATHS.ADMIN_APPLICATIONS}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Review Applications
            </Link>
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
          
          {/* Current Registration Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Registration {currentYear}</h3>
            
            {registrationsLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading registration...</span>
              </div>
            )}
            
            {registrationsError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{registrationsError}</p>
              </div>
            )}
            
            {!registrationsLoading && !registrationsError && !currentRegistration && (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600 mb-4">{registrationStatusMessage}</p>
                {canAccessRegistration && (
                  <Link 
                    to={PATHS.REGISTRATION} 
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Start Registration
                  </Link>
                )}
              </div>
            )}
            
            {!registrationsLoading && !registrationsError && currentRegistration && (
              <div className="space-y-6">
                {/* Registration Status */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-blue-900">Registration Status</h4>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        currentRegistration.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        currentRegistration.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        currentRegistration.status === 'WAITLISTED' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatRegistrationStatus(currentRegistration.status)}
                      </span>
                      {currentRegistration.paymentDeferred && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                          Payment Deferred
                        </span>
                      )}
                    </div>
                  </div>
                  {currentRegistration.status === 'APPLICATION_DECLINED' && currentRegistration.decisionMessage && (
                    <p className="mt-3 text-sm text-gray-700">
                      {currentRegistration.decisionMessage}
                    </p>
                  )}
                  {currentRegistration.status === 'APPLICATION_APPROVED' && (
                    <div className="mt-3">
                      <Link
                        to={PATHS.REGISTRATION}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Complete Registration
                      </Link>
                    </div>
                  )}
                </div>

                {/* Deferred Payment CTA — surfaces a Pay Now button for
                    CONFIRMED registrations created with paymentDeferred=true.
                    Excludes WAITLISTED: payment must not buy a slot the
                    user can't have (capacity > payment), and the payments
                    webhook will refuse to promote WAITLISTED → CONFIRMED.
                    Distinct loading / error states avoid the trap where
                    the badge shows but the CTA is hidden because the
                    camp-registration query is still in flight. */}
                {currentRegistration.paymentDeferred &&
                  currentRegistration.status === 'CONFIRMED' && (
                  <>
                    {campLoading && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600 mr-3"></div>
                        <span className="text-sm text-amber-800">Loading deferred dues…</span>
                      </div>
                    )}
                    {!campLoading && campError && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h5 className="font-medium text-amber-900">Deferred Dues</h5>
                        <p className="text-sm text-amber-800">
                          We couldn't load your deferred dues right now. Please refresh or contact the admins to complete payment.
                        </p>
                      </div>
                    )}
                    {!campLoading && !campError && (() => {
                      const isStaffOrAdmin =
                        user?.role === 'staff' || user?.role === 'admin';
                      const deferredAmount =
                        campRegistration?.campingOptions.reduce((sum, opt) => {
                          const dues = isStaffOrAdmin
                            ? opt.campingOption?.staffDues
                            : opt.campingOption?.participantDues;
                          return sum + (dues ?? 0);
                        }, 0) ?? 0;

                      if (deferredAmount <= 0) return null;

                      return (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h5 className="font-medium text-amber-900">Deferred Dues</h5>
                              <p className="text-sm text-amber-800">
                                You opted to defer payment. Complete your ${deferredAmount.toFixed(2)} dues whenever you're ready.
                              </p>
                            </div>
                          </div>
                          <PaymentButton
                            amount={deferredAmount}
                            registrationId={currentRegistration.id}
                            description={`${config?.name || 'Camp'} Deferred Dues Payment ${config?.currentYear || new Date().getFullYear()}`}
                            onPaymentStart={() => {
                              console.log('Completing deferred payment for registration:', currentRegistration.id);
                            }}
                            onPaymentError={(error) => {
                              console.error('Payment error:', error);
                            }}
                            className="w-full"
                          >
                            Pay Now - ${deferredAmount.toFixed(2)}
                          </PaymentButton>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Work Shifts Section */}
                {currentRegistration.jobs.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Work Shifts</h4>
                    <div className="space-y-4">
                      {currentRegistration.jobs.map((registrationJob) => (
                        <div key={registrationJob.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{registrationJob.job?.name}</h5>
                              <p className="text-sm text-gray-600">{registrationJob.job?.category?.description}</p>
                              <p className="text-sm text-gray-500">
                                {registrationJob.job?.location && `Location: ${registrationJob.job.location}`}
                              </p>
                            </div>
                          </div>
                          
                          {registrationJob.job?.shift && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <h6 className="font-medium text-sm text-gray-700 mb-2">Shift Details</h6>
                              <div className="text-sm text-gray-600">
                                <p>
                                  <strong>Day:</strong> {getFriendlyDayName(registrationJob.job.shift.dayOfWeek)}
                                </p>
                                <p>
                                  <strong>Time:</strong> {formatTime(registrationJob.job.shift.startTime)} - {formatTime(registrationJob.job.shift.endTime)}
                                </p>
                                {registrationJob.job.shift.description && (
                                  <p>
                                    <strong>Description:</strong> {registrationJob.job.shift.description}
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

                {/* Payments Section */}
                {currentRegistration.payments.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Payments</h4>
                    <div className="space-y-2">
                      {currentRegistration.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              ${payment.amount.toFixed(2)} {payment.currency}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(payment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            payment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            payment.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.status === 'COMPLETED' ? 'Completed' :
                             payment.status === 'PENDING' ? 'Pending' :
                             payment.status === 'FAILED' ? 'Failed' :
                             payment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Complete Payment Button for Pending Payments */}
                    {(() => {
                      const pendingPayments = currentRegistration.payments.filter(p => p.status === 'PENDING');
                      const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
                      
                      if (pendingPayments.length > 0 && totalPending > 0) {
                        return (
                          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h5 className="font-medium text-yellow-800">Outstanding Dues</h5>
                                <p className="text-sm text-yellow-700">
                                  You have ${totalPending.toFixed(2)} in pending dues
                                </p>
                              </div>
                            </div>
                            <PaymentButton
                              amount={totalPending}
                              registrationId={currentRegistration.id}
                              description={`${config?.name || 'Camp'} Dues Payment ${config?.currentYear || new Date().getFullYear()}`}
                              onPaymentStart={() => {
                                console.log('Completing pending payment for registration:', currentRegistration.id);
                              }}
                              onPaymentError={(error) => {
                                console.error('Payment error:', error);
                              }}
                              className="w-full"
                            >
                              Complete Dues Payment - ${totalPending.toFixed(2)}
                            </PaymentButton>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camping Options Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Camping</h3>
            
            {campLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading camping options...</span>
              </div>
            )}
            
            {campError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{campError}</p>
              </div>
            )}
            
            {!campLoading && !campError && (!campRegistration?.campingOptions || campRegistration.campingOptions.length === 0) && (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600">No camping options selected.</p>
              </div>
            )}
            
            {!campLoading && !campError && campRegistration?.campingOptions && campRegistration.campingOptions.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
          </div>

          {/* Registration History Section */}
          {!registrationsLoading && !registrationsError && registrationHistory.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Registration History</h3>
              <div className="space-y-4">
                {registrationHistory.map((registration) => (
                  <div key={registration.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        {registration.year} — {new Date(registration.createdAt).toLocaleDateString()}
                      </h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        registration.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        registration.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        registration.status === 'WAITLISTED' ? 'bg-orange-100 text-orange-800' :
                        registration.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatRegistrationStatus(registration.status)}
                      </span>
                    </div>
                    
                    {registration.jobs.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Work Shifts</h5>
                        <div className="space-y-2">
                          {registration.jobs.map((registrationJob) => (
                            <div key={registrationJob.id} className="text-sm text-gray-600">
                              <span className="font-medium">{registrationJob.job?.name}</span>
                              {registrationJob.job?.shift && (
                                <span className="ml-2">
                                  — {getFriendlyDayName(registrationJob.job.shift.dayOfWeek)}{' '}
                                  {formatTime(registrationJob.job.shift.startTime)} - {formatTime(registrationJob.job.shift.endTime)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {registration.payments.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Payments</h5>
                        <div className="space-y-1">
                          {registration.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                ${payment.amount.toFixed(2)} — {new Date(payment.createdAt).toLocaleDateString()}
                              </span>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                payment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                payment.status === 'REFUNDED' ? 'bg-blue-100 text-blue-800' :
                                payment.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {payment.status === 'COMPLETED' ? 'Completed' :
                                 payment.status === 'REFUNDED' ? 'Refunded' :
                                 payment.status === 'FAILED' ? 'Failed' :
                                 payment.status === 'PENDING' ? 'Pending' :
                                 payment.status}
                              </span>
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
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
