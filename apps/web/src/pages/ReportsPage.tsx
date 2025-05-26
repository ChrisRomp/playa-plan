import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, CreditCard } from 'lucide-react';
import { useAuth } from '../store/authUtils';
import { PATHS } from '../routes';

/**
 * Reports landing page
 * Provides navigation to different report types based on user role
 */
export function ReportsPage() {
  const { user } = useAuth();

  const reportLinks = [
    {
      to: PATHS.REPORTS_REGISTRATIONS,
      icon: <FileText size={24} />,
      title: 'Registration Reports',
      description: 'View and analyze camp registrations',
      allowedRoles: ['staff', 'admin'],
    },
    {
      to: PATHS.REPORTS_USERS,
      icon: <Users size={24} />,
      title: 'User Reports',
      description: 'Manage user accounts and profiles',
      allowedRoles: ['staff', 'admin'],
    },
    {
      to: PATHS.REPORTS_PAYMENTS,
      icon: <CreditCard size={24} />,
      title: 'Payment Reports',
      description: 'Review payment transactions and status',
      allowedRoles: ['admin'],
    },
  ];

  // Filter reports based on user role
  const availableReports = reportLinks.filter(report => 
    report.allowedRoles.includes(user?.role || '')
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600 mb-8">
          Access reports and analytics for camp management
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableReports.map((report) => (
            <Link
              key={report.to}
              to={report.to}
              className="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200 group"
            >
              <div className="flex items-center mb-3">
                <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                  {report.icon}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {report.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {report.description}
              </p>
            </Link>
          ))}
        </div>

        {availableReports.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Reports Available
            </h3>
            <p className="text-gray-600">
              You don't have access to any reports with your current role.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
