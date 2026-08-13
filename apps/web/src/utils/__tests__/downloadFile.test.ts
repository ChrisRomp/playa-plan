import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from '../downloadFile';

describe('downloadFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shouldDownloadTheBlobAndReleaseTheObjectUrl', () => {
    vi.useFakeTimers();
    const inputBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const mockCreateObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const mockRevokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const mockClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadFile(inputBlob, 'ticket-report.pdf');

    expect(mockCreateObjectUrl).toHaveBeenCalledWith(inputBlob);
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectUrl).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(mockRevokeObjectUrl).toHaveBeenCalledWith('blob:report');
    expect(document.querySelector('a[download="ticket-report.pdf"]')).toBeNull();
  });
});
