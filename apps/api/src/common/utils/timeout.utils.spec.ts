import { withTimeout } from './timeout.utils';

describe('withTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return resolved value and clear timer', async () => {
    jest.useFakeTimers();

    const result = await withTimeout(Promise.resolve('ok'), 15000, 'timeout');

    expect(result).toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should reject on timeout and clear timer', async () => {
    jest.useFakeTimers();

    const wrappedPromise = withTimeout(new Promise<never>(() => undefined), 1000, 'timeout');
    const timeoutAssertion = expect(wrappedPromise).rejects.toThrow('timeout');

    jest.advanceTimersByTime(1000);
    await timeoutAssertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should reject with original error and clear timer', async () => {
    jest.useFakeTimers();

    const wrappedPromise = withTimeout(Promise.reject(new Error('failure')), 1000, 'timeout');

    await expect(wrappedPromise).rejects.toThrow('failure');
    expect(jest.getTimerCount()).toBe(0);
  });
});
