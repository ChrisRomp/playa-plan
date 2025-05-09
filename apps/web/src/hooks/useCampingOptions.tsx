import { useState, useCallback } from 'react';
import { campingOptions, CampingOption, CampingOptionField } from '../lib/api';

/**
 * Hook for managing camping options
 */
export const useCampingOptions = () => {
  const [options, setOptions] = useState<CampingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<CampingOption | null>(null);
  const [fields, setFields] = useState<CampingOptionField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all camping options
   */
  const loadCampingOptions = useCallback(async (includeDisabled = true, campId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await campingOptions.getAll(includeDisabled, campId);
      setOptions(data);
      return data;
    } catch (err) {
      setError('Failed to load camping options');
      console.error('Error loading camping options:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load a camping option by ID
   */
  const loadCampingOption = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await campingOptions.getById(id);
      setSelectedOption(data);
      return data;
    } catch (err) {
      setError(`Failed to load camping option with ID ${id}`);
      console.error(`Error loading camping option with ID ${id}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new camping option
   */
  const createCampingOption = useCallback(async (data: Omit<CampingOption, 'id' | 'createdAt' | 'updatedAt' | 'currentRegistrations' | 'availabilityStatus' | 'fields'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const newOption = await campingOptions.create(data);
      setOptions(prev => [...prev, newOption]);
      setSelectedOption(newOption);
      return newOption;
    } catch (err) {
      setError('Failed to create camping option');
      console.error('Error creating camping option:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update a camping option
   */
  const updateCampingOption = useCallback(async (id: string, data: Partial<Omit<CampingOption, 'id' | 'createdAt' | 'updatedAt' | 'currentRegistrations' | 'availabilityStatus' | 'fields'>>) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedOption = await campingOptions.update(id, data);
      setOptions(prev => prev.map(option => option.id === id ? updatedOption : option));
      
      if (selectedOption?.id === id) {
        setSelectedOption(updatedOption);
      }
      
      return updatedOption;
    } catch (err) {
      setError(`Failed to update camping option with ID ${id}`);
      console.error(`Error updating camping option with ID ${id}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedOption]);

  /**
   * Delete a camping option
   */
  const deleteCampingOption = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await campingOptions.delete(id);
      setOptions(prev => prev.filter(option => option.id !== id));
      
      if (selectedOption?.id === id) {
        setSelectedOption(null);
      }
      
      return true;
    } catch (err) {
      setError(`Failed to delete camping option with ID ${id}`);
      console.error(`Error deleting camping option with ID ${id}:`, err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedOption]);

  /**
   * Load fields for a camping option
   */
  const loadCampingOptionFields = useCallback(async (campingOptionId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await campingOptions.getFields(campingOptionId);
      setFields(data);
      return data;
    } catch (err) {
      setError(`Failed to load fields for camping option with ID ${campingOptionId}`);
      console.error(`Error loading fields for camping option with ID ${campingOptionId}:`, err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new field for a camping option
   */
  const createCampingOptionField = useCallback(async (
    campingOptionId: string,
    data: Omit<CampingOptionField, 'id' | 'createdAt' | 'updatedAt' | 'campingOptionId'>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const newField = await campingOptions.createField(campingOptionId, data);
      setFields(prev => [...prev, newField]);
      return newField;
    } catch (err) {
      setError(`Failed to create field for camping option with ID ${campingOptionId}`);
      console.error(`Error creating field for camping option with ID ${campingOptionId}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update a field
   */
  const updateCampingOptionField = useCallback(async (
    campingOptionId: string,
    fieldId: string,
    data: Partial<Omit<CampingOptionField, 'id' | 'createdAt' | 'updatedAt' | 'campingOptionId'>>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedField = await campingOptions.updateField(campingOptionId, fieldId, data);
      setFields(prev => prev.map(field => field.id === fieldId ? updatedField : field));
      return updatedField;
    } catch (err) {
      setError(`Failed to update field with ID ${fieldId}`);
      console.error(`Error updating field with ID ${fieldId}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a field
   */
  const deleteCampingOptionField = useCallback(async (campingOptionId: string, fieldId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await campingOptions.deleteField(campingOptionId, fieldId);
      setFields(prev => prev.filter(field => field.id !== fieldId));
      return true;
    } catch (err) {
      setError(`Failed to delete field with ID ${fieldId}`);
      console.error(`Error deleting field with ID ${fieldId}:`, err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    options,
    selectedOption,
    fields,
    loading,
    error,
    loadCampingOptions,
    loadCampingOption,
    createCampingOption,
    updateCampingOption,
    deleteCampingOption,
    loadCampingOptionFields,
    createCampingOptionField,
    updateCampingOptionField,
    deleteCampingOptionField,
  };
}; 