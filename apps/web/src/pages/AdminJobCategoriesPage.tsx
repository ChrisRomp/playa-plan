import { useState } from 'react';
import { useJobCategories } from '../hooks/useJobCategories';
import { JobCategory } from '../lib/api';
import { isAxiosError } from 'axios';

interface CategoryFormState {
  name: string;
  description: string;
}

export default function AdminJobCategoriesPage() {
  const {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    error,
  } = useJobCategories();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>({ name: '', description: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditId(null);
    setForm({ name: '', description: '' });
    setFormError(null);
    setDeleteError(null);
    setModalOpen(true);
  };

  const openEditModal = (category: JobCategory) => {
    setEditId(category.id);
    setForm({ name: category.name, description: category.description });
    setFormError(null);
    setDeleteError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormError(null);
    setDeleteError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      setFormError('Name and description are required.');
      return;
    }
    setFormError(null);
    if (editId) {
      await updateCategory(editId, form);
    } else {
      await createCategory(form);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
    try {
      await deleteCategory(id);
      setDeleteId(null);
      setDeleteError(null);
    } catch (err: unknown) {
      let message = 'Failed to delete job category.';
      
      // Extract error message from Axios error
      if (isAxiosError(err) && err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      
      setDeleteError(message);
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Job Category Management</h1>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {deleteError && <div className="text-red-600 mb-2">{deleteError}</div>}
      <button
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring"
        onClick={openAddModal}
        aria-label="Add job category"
      >
        Add Job Category
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2 border-b">Name</th>
              <th className="px-4 py-2 border-b">Description</th>
              <th className="px-4 py-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...categories]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b">{cat.name}</td>
                <td className="px-4 py-2 border-b">{cat.description}</td>
                <td className="px-4 py-2 border-b text-center">
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="text-blue-500 hover:text-blue-700"
                      aria-label={`Edit ${cat.name}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Delete ${cat.name}`}
                      disabled={deleteId === cat.id}
                    >
                      {deleteId === cat.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-gray-500">No job categories found.</td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <div className="text-center py-4">Loading...</div>}
      </div>
      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editId ? 'Edit' : 'Add'} Job Category</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block font-medium mb-1">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block font-medium mb-1">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="w-full border rounded px-3 py-2"
                  value={form.description}
                  onChange={handleFormChange}
                  required
                  maxLength={500}
                  rows={3}
                />
              </div>
              {formError && <div className="text-red-600 mb-2">{formError}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {editId ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this job category? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                onClick={async () => { await handleDelete(deleteId); }}
                disabled={loading}
                data-testid="confirm-delete-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 