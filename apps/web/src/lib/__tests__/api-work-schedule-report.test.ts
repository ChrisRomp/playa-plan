import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('work schedule report API', () => {
  let mockIsAxiosError: ReturnType<typeof vi.fn>;
  let mockApi: {
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    defaults: { headers: { common: Record<string, unknown> } };
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsAxiosError = vi.fn();
    mockApi = {
      post: vi.fn(),
      get: vi.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => mockApi),
        isAxiosError: mockIsAxiosError,
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('axios');
  });

  it('shouldPostTheSelectedFiltersAndUseTheServerFilename', async () => {
    const inputBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockApi.post.mockResolvedValue({
      data: inputBlob,
      headers: {
        'content-disposition':
          "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''Burning%20Sky%20Work%20Schedule%202026.pdf",
      },
    });
    const { reports } = await import('../api');

    const actualDownload = await reports.generateWorkSchedulePdf({
      dayOfWeek: 'CLOSING_SUNDAY',
      includeStaffOnly: false,
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/reports/work-schedule',
      { dayOfWeek: 'CLOSING_SUNDAY', includeStaffOnly: false },
      { responseType: 'blob', timeout: 30000 }
    );
    expect(actualDownload).toEqual({
      blob: inputBlob,
      filename: 'Burning Sky Work Schedule 2026.pdf',
    });
  });

  it('shouldDescribeAnEmptyFilteredOrFullSchedule', async () => {
    mockIsAxiosError.mockReturnValue(true);
    const { reports } = await import('../api');

    const actualMessage = reports.getWorkScheduleReportErrorMessage({
      response: { status: 404 },
    });

    expect(actualMessage).toBe('No work schedule is available.');
  });

  it('shouldGetScheduleExceptions', async () => {
    const expectedReport = { year: 2026, exceptions: [] };
    mockApi.get.mockResolvedValue({ data: expectedReport });
    const { reports } = await import('../api');

    await expect(reports.getScheduleExceptions()).resolves.toEqual(
      expectedReport,
    );
    expect(mockApi.get).toHaveBeenCalledWith('/reports/schedule-exceptions');
  });
});
