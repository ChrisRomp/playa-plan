import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('work schedule report API', () => {
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
        isAxiosError: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('axios');
  });

  it('shouldPostTheSelectedDayAndUseTheServerFilename', async () => {
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
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/reports/work-schedule',
      { dayOfWeek: 'CLOSING_SUNDAY' },
      { responseType: 'blob', timeout: 30000 }
    );
    expect(actualDownload).toEqual({
      blob: inputBlob,
      filename: 'Burning Sky Work Schedule 2026.pdf',
    });
  });
});
