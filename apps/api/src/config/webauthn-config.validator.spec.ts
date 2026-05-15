import {
  validateWebAuthnConfig,
  WebAuthnConfigError,
  WebAuthnConfig,
} from './webauthn-config.validator';

describe('validateWebAuthnConfig', () => {
  const baseConfig: WebAuthnConfig = {
    rpName: 'PlayaPlan',
    rpId: 'playaplan.app',
    origin: 'https://playaplan.app',
  };

  it('should accept exact rpId/origin match', () => {
    expect(() => validateWebAuthnConfig(baseConfig)).not.toThrow();
  });

  it('should accept rpId as registrable parent of origin (subdomain)', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'playaplan.app',
        origin: 'https://test.playaplan.app',
      }),
    ).not.toThrow();
  });

  it('should accept exact subdomain match', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'test.playaplan.app',
        origin: 'https://test.playaplan.app',
      }),
    ).not.toThrow();
  });

  it('should accept origin with custom port', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'playaplan.app',
        origin: 'https://test.playaplan.app:8443',
      }),
    ).not.toThrow();
  });

  it('should reject sibling subdomain (api-test vs test)', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'api-test.playaplan.app',
        origin: 'https://test.playaplan.app',
      }),
    ).toThrow(WebAuthnConfigError);
  });

  it('should reject prefix-match attack (evilplayaplan.app vs playaplan.app)', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'playaplan.app',
        origin: 'https://evilplayaplan.app',
      }),
    ).toThrow(WebAuthnConfigError);
  });

  it('should reject single-label rpId (public suffix)', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: 'app',
        origin: 'https://test.playaplan.app',
      }),
    ).toThrow(/must contain at least one dot/);
  });

  it('should accept localhost rpId with localhost origin', () => {
    expect(() =>
      validateWebAuthnConfig({
        rpName: 'PlayaPlan',
        rpId: 'localhost',
        origin: 'http://localhost:5173',
      }),
    ).not.toThrow();
  });

  it('should reject localhost rpId with non-localhost origin', () => {
    expect(() =>
      validateWebAuthnConfig({
        rpName: 'PlayaPlan',
        rpId: 'localhost',
        origin: 'https://test.playaplan.app',
      }),
    ).toThrow(WebAuthnConfigError);
  });

  it('should accept 127.0.0.1 rpId with 127.0.0.1 origin (loopback)', () => {
    expect(() =>
      validateWebAuthnConfig({
        rpName: 'PlayaPlan',
        rpId: '127.0.0.1',
        origin: 'http://127.0.0.1:5173',
      }),
    ).not.toThrow();
  });

  it('should reject 127.0.0.1 rpId with non-loopback origin', () => {
    expect(() =>
      validateWebAuthnConfig({
        rpName: 'PlayaPlan',
        rpId: '127.0.0.1',
        origin: 'https://test.playaplan.app',
      }),
    ).toThrow(WebAuthnConfigError);
  });

  it('should reject empty rpName', () => {
    expect(() =>
      validateWebAuthnConfig({ ...baseConfig, rpName: '' }),
    ).toThrow(/RP_NAME/);
  });

  it('should reject empty rpId', () => {
    expect(() =>
      validateWebAuthnConfig({ ...baseConfig, rpId: '' }),
    ).toThrow(/RP_ID/);
  });

  it('should reject malformed origin URL', () => {
    expect(() =>
      validateWebAuthnConfig({ ...baseConfig, origin: 'not-a-url' }),
    ).toThrow(/not a valid URL/);
  });

  it('should reject IPv4 address as rpId', () => {
    expect(() =>
      validateWebAuthnConfig({
        ...baseConfig,
        rpId: '192.168.1.1',
        origin: 'https://192.168.1.1',
      }),
    ).toThrow(/IP address/);
  });
});
