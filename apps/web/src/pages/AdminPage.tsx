import React from 'react';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';

/**
 * Admin page component for system management
 * Only accessible to users with ADMIN role
 */
const AdminPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <p className="mb-4 text-gray-600">
        Welcome, {user?.name}. You are currently logged in as an administrator.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
          <p className="text-gray-600 mb-4">View and manage user accounts, roles, and permissions.</p>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            Manage Users →
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Camp Configuration</h2>
          <p className="text-gray-600 mb-4">Update camp settings, dates, and registration options.</p>
          <Link to={ROUTES.ADMIN_CONFIG.path} className="text-blue-600 hover:text-blue-800 font-medium">
            Edit Configuration →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Shifts</h2>
          <p className="text-gray-600 mb-4">Create and manage job shifts and assignments.</p>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            Manage Shifts →
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments</h2>
          <p className="text-gray-600 mb-4">Review payment status and manage transactions.</p>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            Manage Payments →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
