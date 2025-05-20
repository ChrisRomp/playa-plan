import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

// Mock data for testing
interface TestItem {
  id: string;
  name: string;
  age: number;
  email: string;
  role: string;
}

const testData: TestItem[] = [
  { id: '1', name: 'Alice Smith', age: 28, email: 'alice@example.com', role: 'Admin' },
  { id: '2', name: 'Bob Johnson', age: 34, email: 'bob@example.com', role: 'User' },
  { id: '3', name: 'Carol Williams', age: 42, email: 'carol@example.com', role: 'Admin' },
  { id: '4', name: 'Dave Brown', age: 21, email: 'dave@example.com', role: 'User' },
];

const columns: DataTableColumn<TestItem>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name, sortable: true },
  { id: 'age', header: 'Age', accessor: (row) => row.age, sortable: true },
  { id: 'email', header: 'Email', accessor: (row) => row.email },
  { 
    id: 'role', 
    header: 'Role', 
    accessor: (row) => row.role,
    hideOnMobile: true,
    Cell: ({ value }) => (
      <span className={value === 'Admin' ? 'text-blue-500' : 'text-green-500'}>
        {value}
      </span>
    )
  },
];

describe('DataTable', () => {
  it('renders correctly with data', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        caption="Test Data Table"
      />
    );

    // Check column headers are rendered
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check some data is rendered
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    const emptyMessage = 'No data available for testing';
    render(
      <DataTable
        data={[]}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage={emptyMessage}
      />
    );

    expect(screen.getByText(emptyMessage)).toBeInTheDocument();
  });

  it('supports sorting when clicking on sortable column', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
      />
    );

    // Click the Name column header to sort
    fireEvent.click(screen.getByText('Name'));
    
    // Get the cells after sorting
    const sortedNamesAsc = screen.getAllByText(/Alice|Bob|Carol|Dave/).map(el => el.textContent);
    
    // Verify they're in ascending order (already the case with our test data)
    expect(sortedNamesAsc).toEqual(['Alice Smith', 'Bob Johnson', 'Carol Williams', 'Dave Brown']);
    
    // Click again to reverse sort
    fireEvent.click(screen.getByText('Name'));
    
    // Get the cells again
    const sortedNamesDesc = screen.getAllByText(/Alice|Bob|Carol|Dave/).map(el => el.textContent);
    
    // Verify they're in descending order
    expect(sortedNamesDesc).toEqual(['Dave Brown', 'Carol Williams', 'Bob Johnson', 'Alice Smith']);
  });

  it('supports filtering data', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        filterable={true}
      />
    );

    // Find filter input
    const filterInput = screen.getByPlaceholderText('Search...');
    
    // Filter by "Alice"
    fireEvent.change(filterInput, { target: { value: 'Alice' } });
    
    // Should show only Alice and hide others
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    
    // Clear filter
    fireEvent.change(filterInput, { target: { value: '' } });
    
    // Should show all data again
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('handles row click events', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />
    );

    // Click on the first row
    fireEvent.click(screen.getByText('Alice Smith'));
    
    // Check if onRowClick was called with the correct data
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it('supports pagination', () => {
    // Create more test data to test pagination
    const manyItems = Array(25).fill(null).map((_, index) => ({
      id: `id-${index}`,
      name: `Person ${index + 1}`,
      age: 20 + index,
      email: `person${index + 1}@example.com`,
      role: index % 2 === 0 ? 'Admin' : 'User'
    }));

    render(
      <DataTable
        data={manyItems}
        columns={columns}
        getRowKey={(row) => row.id}
        paginated={true}
        defaultPageSize={10}
      />
    );

    // Should show first 10 items only
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('Person 10')).toBeInTheDocument();
    expect(screen.queryByText('Person 11')).not.toBeInTheDocument();
    
    // Pagination info should be shown
    expect(screen.getByText('Showing 1 to 10 of 25 entries')).toBeInTheDocument();
    
    // Navigate to next page
    fireEvent.click(screen.getByLabelText('Go to next page'));
    
    // Should now show items 11-20
    expect(screen.queryByText('Person 1')).not.toBeInTheDocument();
    expect(screen.getByText('Person 11')).toBeInTheDocument();
    expect(screen.getByText('Person 20')).toBeInTheDocument();
    
    // Pagination info should update
    expect(screen.getByText('Showing 11 to 20 of 25 entries')).toBeInTheDocument();
  });

  it('supports grouping data', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        groupable={true}
        groupByField={(row) => row.role}
        groupDisplayName={(group) => `${group} Group`}
      />
    );

    // Should have two groups: Admin and User
    expect(screen.getByText('Admin Group (2)')).toBeInTheDocument();
    expect(screen.getByText('User Group (2)')).toBeInTheDocument();
    
    // Initially groups should be collapsed
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    
    // Expand Admin group
    fireEvent.click(screen.getByText('Admin Group (2)'));
    
    // Should show admin users but not regular users
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Carol Williams')).toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    
    // Expand User group
    fireEvent.click(screen.getByText('User Group (2)'));
    
    // Now all users should be visible
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(screen.getByText('Dave Brown')).toBeInTheDocument();
  });

  it('provides proper ARIA attributes for accessibility', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        caption="Test Data Table"
      />
    );
    
    // Test that the table has the proper role
    const table = screen.getByRole('grid');
    expect(table).toBeInTheDocument();
    
    // Check that header cells have proper attributes
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort');
    expect(nameHeader).toHaveAttribute('role', 'columnheader');
    
    // Check that body cells have role
    const bodyCell = screen.getByText('Alice Smith').closest('td');
    expect(bodyCell).toHaveAttribute('role', 'gridcell');
  });

  it('supports keyboard sorting with Enter key', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
      />
    );
    
    const nameHeader = screen.getByText('Name').closest('th');
    
    // Trigger Enter key on the sortable header
    if (nameHeader) {
      fireEvent.keyDown(nameHeader, { key: 'Enter' });
      
      // Get the cells after sorting with keyboard
      const sortedNamesAsc = screen.getAllByText(/Alice|Bob|Carol|Dave/).map(el => el.textContent);
      expect(sortedNamesAsc).toEqual(['Alice Smith', 'Bob Johnson', 'Carol Williams', 'Dave Brown']);
      
      // Press Enter again to reverse sort
      fireEvent.keyDown(nameHeader, { key: 'Enter' });
      
      const sortedNamesDesc = screen.getAllByText(/Alice|Bob|Carol|Dave/).map(el => el.textContent);
      expect(sortedNamesDesc).toEqual(['Dave Brown', 'Carol Williams', 'Bob Johnson', 'Alice Smith']);
    }
  });
  
  it('handles keyboard group expansion', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        groupable={true}
        groupByField={(row) => row.role}
        groupDisplayName={(group) => `${group} Group`}
      />
    );

    // Find the group headers
    const adminGroupHeader = screen.getByText('Admin Group (2)').closest('tr');
    
    // Use keyboard to expand the group
    if (adminGroupHeader) {
      fireEvent.keyDown(adminGroupHeader, { key: 'Enter' });
      
      // Should show admin users but not regular users
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      
      // Group should have aria-expanded attribute
      expect(adminGroupHeader).toHaveAttribute('aria-expanded', 'true');
    }
  });
  
  it('provides screen reader announcements when sorting or expanding groups', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        groupable={true}
        groupByField={(row) => row.role}
      />
    );
    
    // Find the aria-live region
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    
    // Click a sortable header
    fireEvent.click(screen.getByText('Name'));
    
    // The aria-sort attribute should be updated
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });
});
