import { resolveThrottleLimits } from './throttling.module';

describe('resolveThrottleLimits', () => {
  it('should keep legacy capped defaults when overrides are not provided', () => {
    const getNumber = (key: string): number | undefined => {
      void key;
      return undefined;
    };

    const actualLimits = resolveThrottleLimits(getNumber, 1000);

    expect(actualLimits).toEqual({
      defaultLimit: 300,
      authLimit: 30,
    });
  });

  it('should use explicit default and auth limit overrides when provided', () => {
    const configValues: Record<string, number> = {
      THROTTLE_DEFAULT_LIMIT: 2500,
      THROTTLE_AUTH_LIMIT: 500,
    };
    const getNumber = (key: string): number | undefined => configValues[key];

    const actualLimits = resolveThrottleLimits(getNumber, 200);

    expect(actualLimits).toEqual({
      defaultLimit: 2500,
      authLimit: 500,
    });
  });

  it('should allow overriding only one throttle bucket', () => {
    const configValues: Record<string, number> = {
      THROTTLE_AUTH_LIMIT: 120,
    };
    const getNumber = (key: string): number | undefined => configValues[key];

    const actualLimits = resolveThrottleLimits(getNumber, 280);

    expect(actualLimits).toEqual({
      defaultLimit: 280,
      authLimit: 120,
    });
  });
});
