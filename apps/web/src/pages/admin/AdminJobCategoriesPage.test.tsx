import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminJobCategoriesPage from '../AdminJobCategoriesPage';
import * as useJobCategoriesModule from '../../hooks/useJobCategories';
import { describe, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const mockCategories = [
  { id: '1', name: 'Kitchen', description: 'Kitchen jobs' },
  { id: '2', name: 'Greeter', description: 'Greeting jobs' },
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
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Greeter')).toBeInTheDocument();
  });

  it('should open and submit the add category modal', async () => {
    render(<AdminJobCategoriesPage />);
    fireEvent.click(screen.getByLabelText('Add job category'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'NewCat' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Desc' } });
    fireEvent.click(screen.getByText('Add Category'));
    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({ name: 'NewCat', description: 'Desc' });
    });
  });

  it('should open and submit the edit category modal', async () => {
    render(<AdminJobCategoriesPage />);
    fireEvent.click(screen.getByLabelText('Edit Kitchen'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith('1', { name: 'Updated', description: 'Kitchen jobs' });
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