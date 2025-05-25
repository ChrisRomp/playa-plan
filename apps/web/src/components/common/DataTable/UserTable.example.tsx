import React, { useState, useEffect } from 'react';
import { DataTable } from './index';
import type { DataTableColumn } from './DataTable';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: Date;
  isActive: boolean;
}

/**
 * Example component demonstrating how to use the DataTable component
 */
export const UserTable: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Example of data fetching
  useEffect(() => {
    // In a real app, this would be an API call
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock user data
        const mockUsers: User[] = [
          {
            id: '1',
            name: 'Alex Johnson',
            email: 'alex@example.com',
            role: 'Admin',
            lastLogin: new Date('2025-05-15'),
            isActive: true
          },
          {
            id: '2',
            name: 'Sam Wilson',
            email: 'sam@example.com',
            role: 'Staff',
            lastLogin: new Date('2025-05-10'),
            isActive: true
          },
          {
            id: '3',
            name: 'Jamie Parker',
            email: 'jamie@example.com',
            role: 'Participant',
            lastLogin: new Date('2025-04-28'),
            isActive: false
          },
          {
            id: '4',
            name: 'Taylor Smith',
            email: 'taylor@example.com',
            role: 'Staff',
            lastLogin: new Date('2025-05-18'),
            isActive: true
          },
          {
            id: '5',
            name: 'Morgan Davis',
            email: 'morgan@example.com',
            role: 'Participant',
            lastLogin: new Date('2025-05-01'),
            isActive: true
          }
        ];
        
        setUsers(mockUsers);
        setError(null);
      } catch (err) {
        setError('Failed to fetch users');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Define columns for the user table
  const columns: DataTableColumn<User>[] = [
    {
      id: 'name',
      header: 'Name',
      accessor: (user) => user.name,
      sortable: true
    },
    {
      id: 'email',
      header: 'Email',
      accessor: (user) => user.email
    },
    {
      id: 'role',
      header: 'Role',
      accessor: (user) => user.role,
      sortable: true,
      Cell: ({ value }) => {
        let color;
        switch (value) {
          case 'Admin':
            color = 'bg-purple-100 text-purple-800';
            break;
          case 'Staff':
            color = 'bg-blue-100 text-blue-800';
            break;
          default:
            color = 'bg-green-100 text-green-800';
        }
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs ${color}`}>
            {value}
          </span>
        );
      }
    },
    {
      id: 'lastLogin',
      header: 'Last Login',
      accessor: (user) => user.lastLogin.toLocaleDateString(),
      sortable: true,
      hideOnMobile: true
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (user) => user.isActive,
      Cell: ({ value }) => (
        <span className={value ? 'text-green-600' : 'text-red-600'}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ];

  // Handle row click
  const handleRowClick = (user: User) => {
    console.log('User clicked:', user);
    // In a real app, you might navigate to a user details page
    // history.push(`/users/${user.id}`);
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading users...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      <DataTable
        data={users}
        columns={columns}
        getRowKey={(user) => user.id}
        filterable={true}
        paginated={true}
        defaultPageSize={10}
        caption="User Directory"
        onRowClick={handleRowClick}
        className="shadow-sm"
        emptyMessage="No users found"
        initialSort={{ id: 'name', direction: 'asc' }}
      />
    </div>
  );
};

export default UserTable;
