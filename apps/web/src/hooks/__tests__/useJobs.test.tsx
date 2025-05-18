import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useJobs } from '../useJobs';
import { jobs } from '../../lib/api';

// Mock the API
vi.mock('../../lib/api', () => ({
  jobs: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useJobs', () => {
  const mockJobs = [
    { 
      id: '1', 
      name: 'Test Job 1', 
      description: 'Test Description 1', 
      location: 'Test Location 1',
      categoryId: 'category1',
      staffOnly: false,
      alwaysRequired: false,
      category: {
        id: 'category1',
        name: 'Test Category 1',
        description: 'Test Category Description 1',
        staffOnly: false,
        alwaysRequired: false
      }
    },
    { 
      id: '2', 
      name: 'Test Job 2', 
      description: 'Test Description 2', 
      location: 'Test Location 2',
      categoryId: 'category2',
      staffOnly: true,
      alwaysRequired: false,
      category: {
        id: 'category2',
        name: 'Test Category 2',
        description: 'Test Category Description 2',
        staffOnly: true,
        alwaysRequired: false
      }
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (jobs.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockJobs);
  });

  it('should fetch jobs on mount', async () => {
    const { result } = renderHook(() => useJobs());

    expect(result.current.loading).toBe(true);
    expect(jobs.getAll).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs).toEqual(mockJobs);
    expect(result.current.error).toBeNull();
  });

  it('should create a job', async () => {
    const newJob = {
      name: 'New Job',
      description: 'New Description',
      location: 'New Location',
      categoryId: 'category1',
    };

    const createdJob = { 
      ...newJob, 
      id: '3',
      staffOnly: false,
      alwaysRequired: false,
      category: {
        id: 'category1',
        name: 'Test Category 1',
        description: 'Test Category Description 1',
        staffOnly: false,
        alwaysRequired: false
      }
    };
    
    (jobs.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdJob);

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const created = await result.current.createJob(newJob);
      expect(created).toEqual(createdJob);
    });

    expect(jobs.create).toHaveBeenCalledWith(newJob);
    expect(result.current.jobs).toEqual([...mockJobs, createdJob]);
  });

  it('should update a job', async () => {
    const updateData = {
      name: 'Updated Job',
      description: 'Updated Description',
    };

    const updatedJob = { 
      ...mockJobs[0], 
      ...updateData,
      staffOnly: mockJobs[0].staffOnly,
      alwaysRequired: mockJobs[0].alwaysRequired
    };
    
    (jobs.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedJob);

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const updated = await result.current.updateJob('1', updateData);
      expect(updated).toEqual(updatedJob);
    });

    expect(jobs.update).toHaveBeenCalledWith('1', updateData);
    expect(result.current.jobs[0]).toEqual(updatedJob);
  });

  it('should delete a job', async () => {
    (jobs.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockJobs[0]);

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const deleted = await result.current.deleteJob('1');
      expect(deleted).toBe(true);
    });

    expect(jobs.delete).toHaveBeenCalledWith('1');
    expect(result.current.jobs).toEqual([mockJobs[1]]);
  });

  it('should handle errors when fetching jobs', async () => {
    (jobs.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));
    
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch jobs');
  });
}); 