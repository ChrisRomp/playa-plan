import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { User, CreateUserDTO, UpdateUserDTO } from '../types/users';
import { ROUTES } from '../routes';

/**
 * Admin User Management Page
 * Allows administrators to view, create, edit, and delete users
 */
const AdminUserPage: React.FC = () => {
  const {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    selectedUser,
    setSelectedUser
  } = useUsers();

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateUserDTO | UpdateUserDTO>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'PARTICIPANT',
    allowRegistration: true,
  });

  // Filter and sort users by first name
  const filteredSortedUsers = useMemo(() => {
    return [...users]
      .filter(user => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(searchLower) ||
          user.lastName.toLowerCase().includes(searchLower) ||
          (user.playaName && user.playaName.toLowerCase().includes(searchLower)) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.role.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [users, searchTerm]);

  // Reset form and state
  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'PARTICIPANT',
      allowRegistration: true,
    });
    setIsCreating(false);
    setIsEditing(false);
    setSelectedUser(null);
  };

  // Handle selecting a user for editing
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      playaName: user.playaName || '',
      role: user.role,
      phone: user.phone || '',
      city: user.city || '',
      stateProvince: user.stateProvince || '',
      country: user.country || '',
      emergencyContact: user.emergencyContact || '',
      profilePicture: user.profilePicture || '',
      allowRegistration: user.allowRegistration || false,
      allowEarlyRegistration: user.allowEarlyRegistration || false,
      allowDeferredDuesPayment: user.allowDeferredDuesPayment || false,
      allowNoJob: user.allowNoJob || false,
      internalNotes: user.internalNotes || '',
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev: CreateUserDTO | UpdateUserDTO) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev: CreateUserDTO | UpdateUserDTO) => ({ ...prev, [name]: value }));
    }
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle form submission for creating or updating users
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating) {
      await createUser(formData as CreateUserDTO);
      resetForm();
    } else if (isEditing && selectedUser) {
      await updateUser(selectedUser.id, formData as UpdateUserDTO);
      resetForm();
    }
  };

  // Handle clicking the delete button - opens the confirmation modal
  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row click event
    setDeleteUserId(id);
    setIsDeleteModalOpen(true);
  };

  // Handle user deletion after confirmation
  const handleDeleteConfirm = async () => {
    if (deleteUserId) {
      await deleteUser(deleteUserId);
      setIsDeleteModalOpen(false);
      setDeleteUserId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-xl">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="ml-auto flex space-x-2">
          <Link 
            to={ROUTES.ADMIN.path}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            aria-label="Back to Admin"
          >
            <span>Back to Admin</span>
          </Link>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            onClick={() => {
              resetForm();
              setIsCreating(true);
            }}
            aria-label="Add User"
          >
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          <p>Error: {error}</p>
          <button 
            onClick={() => fetchUsers()}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      )}

      {/* Main content with user list and form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow overflow-hidden rounded-md">
            {/* Search field */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  className="block w-full pr-10 sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Search users by name, email, role..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <ul className="divide-y divide-gray-200">
              {filteredSortedUsers.length === 0 ? (
                <li className="px-6 py-4 text-center text-gray-500">
                  {searchTerm ? 'No users found matching your search' : 'No users found'}
                </li>
              ) : (
                filteredSortedUsers.map(user => (
                  <li 
                    key={user.id}
                    className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${selectedUser?.id === user.id ? 'bg-blue-50' : ''}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          {user.profilePicture ? (
                            <img src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} className="h-10 w-10 rounded-full" />
                          ) : (
                            <span className="text-gray-500">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName} {user.playaName && `(${user.playaName})`}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 
                          user.role === 'STAFF' ? 'bg-blue-100 text-blue-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                        <button
                          onClick={(e) => handleDeleteClick(user.id, e)}
                          className="text-red-600 hover:text-red-900"
                          aria-label={`Delete user ${user.firstName} ${user.lastName}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* User Form */}
        <div className="lg:col-span-1">
          {(isCreating || isEditing) && (
            <div className="bg-white shadow rounded-md p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {isCreating ? 'Create New User' : 'Edit User'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {/* Basic Information Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Basic Information</h3>
                    
                    <div className="space-y-4">
                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          required
                          value={formData.email || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>


                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* First Name */}
                        <div>
                          <label htmlFor="firstName" className="block text-gray-700 font-medium mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            id="firstName"
                            required
                            value={formData.firstName || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Last Name */}
                        <div>
                          <label htmlFor="lastName" className="block text-gray-700 font-medium mb-2">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            id="lastName"
                            required
                            value={formData.lastName || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Playa Name */}
                      <div>
                        <label htmlFor="playaName" className="block text-gray-700 font-medium mb-2">
                          Playa Name
                        </label>
                        <input
                          type="text"
                          name="playaName"
                          id="playaName"
                          value={formData.playaName || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Role */}
                      <div>
                        <label htmlFor="role" className="block text-gray-700 font-medium mb-2">
                          Role *
                        </label>
                        <select
                          name="role"
                          id="role"
                          required
                          value={formData.role || 'PARTICIPANT'}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PARTICIPANT">Participant</option>
                          <option value="STAFF">Staff</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 pb-2 border-b">User Permissions</h3>
                    <div className="space-y-2">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          name="allowRegistration"
                          id="allowRegistration"
                          checked={!!formData.allowRegistration}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                        />
                        <label htmlFor="allowRegistration" className="ml-2 block text-sm text-gray-700">
                          Allow registration
                        </label>
                      </div>
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          name="allowEarlyRegistration"
                          id="allowEarlyRegistration"
                          checked={!!formData.allowEarlyRegistration}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                        />
                        <label htmlFor="allowEarlyRegistration" className="ml-2 block text-sm text-gray-700">
                          Allow early registration
                        </label>
                      </div>
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          name="allowDeferredDuesPayment"
                          id="allowDeferredDuesPayment"
                          checked={!!formData.allowDeferredDuesPayment}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                        />
                        <label htmlFor="allowDeferredDuesPayment" className="ml-2 block text-sm text-gray-700">
                          Allow deferred payment
                        </label>
                      </div>
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          name="allowNoJob"
                          id="allowNoJob"
                          checked={!!formData.allowNoJob}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                        />
                        <label htmlFor="allowNoJob" className="ml-2 block text-sm text-gray-700">
                          Allow no job requirement
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Internal Notes</h3>
                    <div>
                      <label htmlFor="internalNotes" className="block text-gray-700 font-medium mb-2">
                        Notes (visible to administrators only)
                      </label>
                      <textarea
                        name="internalNotes"
                        id="internalNotes"
                        rows={3}
                        value={formData.internalNotes || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 mt-8">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                    >
                      {isCreating ? 'Create' : 'Update'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {!isCreating && !isEditing && (
            <div className="bg-white shadow rounded-md p-6 text-center">
              <p className="text-gray-500">Select a user to edit or click "Add User" to create a new user</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserPage; 