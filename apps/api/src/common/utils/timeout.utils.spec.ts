import { withTimeout } from './timeout.utils';

describe('withTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns resolved value and clears timer', async () => {
    jest.useFakeTimers();

    const result = await withTimeout(Promise.resolve('ok'), 15000, 'timeout');

    expect(result).toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects on timeout and clears timer', async () => {
    jest.useFakeTimers();

    const resultPromise = withTimeout(new Promise<never>(() => undefined), 1000, 'timeout');
    jest.advanceTimersByTime(1000);

    await expect(resultPromise).rejects.toThrow('timeout');
    expect(jest.getTimerCount()).toBe(0);
  });
});
