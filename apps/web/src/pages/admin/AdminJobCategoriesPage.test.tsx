import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminJobCategoriesPage from '../AdminJobCategoriesPage';
import * as useJobCategoriesModule from '../../hooks/useJobCategories';
import { describe, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const mockCategories = [
  { id: '1', name: 'Kitchen', description: 'Kitchen jobs', staffOnly: false },
  { id: '2', name: 'Greeter', description: 'Greeting jobs', staffOnly: true },
];

describe('AdminJobCategoriesPage', () => {
  let createCategory: Mock;
  let updateCategory: Mock;
  let deleteCategory: Mock;

  beforeEach(() => {
    createCategory = vi.fn();
    updateCategory = vi.fn();
    deleteCategory = vi.fn();
    vi.spyOn(useJobCategoriesModule, 'useJobCategories').mockReturnValue({
      categories: mockCategories,
      loading: false,
      error: null,
      fetchCategories: vi.fn(),
      createCategory,
      updateCategory,
      deleteCategory,
    });
  });

  it('should render the job categories table', () => {
    render(<AdminJobCategoriesPage />);
    expect(screen.getByText('Job Category Management')).toBeInTheDocument();
    
    // Check that the categories are rendered
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Greeter')).toBeInTheDocument();
    expect(screen.getByText('All Users')).toBeInTheDocument();
    
    // Check staffOnly status by finding the table rows and checking the staffOnly cell
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    
    // Check that we have the expected number of rows
    expect(rows).toHaveLength(2); // 2 categories from mock data
    
    // Count how many rows have staffOnly set to true
    const staffOnlyCount = Array.from(rows).filter(row => {
      const staffOnlyCell = row.querySelector('td:nth-child(3)'); // 3rd column is staffOnly
      return staffOnlyCell?.textContent?.includes('Staff Only') || false;
    }).length;
    
    // Verify that we have 1 staffOnly category (from mock data)
    expect(staffOnlyCount).toBe(1);
  });

  it('should open and submit the add category modal', async () => {
    render(<AdminJobCategoriesPage />);
    fireEvent.click(screen.getByLabelText('Add job category'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'NewCat' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Desc' } });
    // By default, staffOnly should be unchecked
    expect(screen.getByLabelText(/Staff Only/)).not.toBeChecked();
    fireEvent.click(screen.getByText('Add Category'));
    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({ 
        name: 'NewCat', 
        description: 'Desc',
        staffOnly: false 
      });
    });
  });

  it('should set staffOnly to true when checkbox is checked in add modal', async () => {
    render(<AdminJobCategoriesPage />);
    fireEvent.click(screen.getByLabelText('Add job category'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'StaffCat' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Staff Desc' } });
    fireEvent.click(screen.getByLabelText(/Staff Only/));
    fireEvent.click(screen.getByText('Add Category'));
    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({ 
        name: 'StaffCat', 
        description: 'Staff Desc',
        staffOnly: true 
      });
    });
  });

  it('should open edit modal with staffOnly checked for staff-only categories', () => {
    render(<AdminJobCategoriesPage />);
    // Open the Greeter category (staffOnly: true)
    fireEvent.click(screen.getByLabelText('Edit Greeter'));
    expect(screen.getByLabelText(/Staff Only/)).toBeChecked();
  });

  it('should open and submit the edit category modal', async () => {
    render(<AdminJobCategoriesPage />);
    fireEvent.click(screen.getByLabelText('Edit Kitchen'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated' } });
    // Checkbox should be unchecked by default for "Kitchen" category
    expect(screen.getByLabelText(/Staff Only/)).not.toBeChecked();
    // Check the staffOnly checkbox
    fireEvent.click(screen.getByLabelText(/Staff Only/));
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith('1', { 
        name: 'Updated', 
        description: 'Kitchen jobs',
        staffOnly: true 
      });
    });
  });

  it('should call deleteCategory when delete is confirmed', async () => {
    render(<AdminJobCategoriesPage />);
    // First click the delete button to open the confirmation modal
    fireEvent.click(screen.getByLabelText('Delete Kitchen'));
    // Then click the confirm delete button in the modal using the test ID
    fireEvent.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith('1');
    });
  });

  it('should show loading state', () => {
    vi.spyOn(useJobCategoriesModule, 'useJobCategories').mockReturnValue({
      categories: [],
      loading: true,
      error: null,
      fetchCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    });
    render(<AdminJobCategoriesPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.spyOn(useJobCategoriesModule, 'useJobCategories').mockReturnValue({
      categories: [],
      loading: false,
      error: 'Failed to fetch',
      fetchCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    });
    render(<AdminJobCategoriesPage />);
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('should render the empty state when no categories are available', () => {
    vi.spyOn(useJobCategoriesModule, 'useJobCategories').mockReturnValue({
      categories: [],
      loading: false,
      error: null,
      fetchCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    });
    render(<AdminJobCategoriesPage />);
    expect(screen.getByText('No job categories found.')).toBeInTheDocument();
  });

  it('should display error message when deleteCategory fails', async () => {
    // Simulate a deletion error
    const errorMessage = 'Cannot delete category because it is in use by one or more jobs.';
    deleteCategory.mockRejectedValue(new Error(errorMessage));
    
    render(<AdminJobCategoriesPage />);
    
    // Open the delete confirmation modal
    fireEvent.click(screen.getByLabelText('Delete Kitchen'));
    
    // Confirm deletion
    fireEvent.click(screen.getByTestId('confirm-delete-button'));
    
    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
}); 