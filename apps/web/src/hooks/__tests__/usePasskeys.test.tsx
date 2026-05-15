import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { usePasskeys } from '../usePasskeys';
import { passkeysApi, isPasskeySupported } from '../../lib/api/passkeys';
import * as webauthn from '@simplewebauthn/browser';

vi.mock('../../lib/api/passkeys', () => ({
  passkeysApi: {
    list: vi.fn(),
    registrationOptions: vi.fn(),
    registrationVerify: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    authenticationOptions: vi.fn(),
    authenticationVerify: vi.fn(),
  },
  isPasskeySupported: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

const mockApi = vi.mocked(passkeysApi);
const mockIsSupported = vi.mocked(isPasskeySupported);
const mockStartReg = vi.mocked(webauthn.startRegistration);

const samplePasskey = {
  id: 'pk-1',
  nickname: 'My Phone',
  transports: ['internal'],
  backedUp: true,
  deviceType: 'multiDevice',
  lastUsedAt: null,
  createdAt: new Date('2026-04-01'),
};

describe('usePasskeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);
  });

  it('loads the passkey list on mount when supported', async () => {
    mockApi.list.mockResolvedValue([samplePasskey]);
    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.passkeys).toHaveLength(1));
    expect(mockApi.list).toHaveBeenCalledOnce();
    expect(result.current.passkeys[0].id).toBe('pk-1');
  });

  it('skips loading when WebAuthn is unsupported', async () => {
    mockIsSupported.mockReturnValue(false);
    const { result } = renderHook(() => usePasskeys());
    expect(mockApi.list).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(false);
  });

  it('register() runs the WebAuthn ceremony with v13 optionsJSON wrapper', async () => {
    mockApi.list.mockResolvedValue([]);
    mockApi.registrationOptions.mockResolvedValue({ challenge: 'c' });
    mockStartReg.mockResolvedValue({ id: 'cred-x' } as never);
    mockApi.registrationVerify.mockResolvedValue(samplePasskey);

    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned;
    await act(async () => {
      returned = await result.current.register('My Phone');
    });

    expect(returned).toEqual(samplePasskey);
    expect(mockStartReg).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } });
    expect(mockApi.registrationVerify).toHaveBeenCalledWith({ id: 'cred-x' }, 'My Phone');
    expect(result.current.passkeys[0]).toEqual(samplePasskey);
  });

  it('register() surfaces errors as state and returns null', async () => {
    mockApi.list.mockResolvedValue([]);
    mockApi.registrationOptions.mockRejectedValue(new Error('options failed'));
    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned;
    await act(async () => {
      returned = await result.current.register();
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe('options failed');
  });

  it('rename() updates the matching entry in place', async () => {
    mockApi.list.mockResolvedValue([samplePasskey]);
    mockApi.rename.mockResolvedValue({ ...samplePasskey, nickname: 'Renamed' });
    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.passkeys).toHaveLength(1));

    await act(async () => {
      await result.current.rename('pk-1', 'Renamed');
    });
    expect(result.current.passkeys[0].nickname).toBe('Renamed');
  });

  it('remove() drops the entry from state on success', async () => {
    mockApi.list.mockResolvedValue([samplePasskey]);
    mockApi.remove.mockResolvedValue();
    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.passkeys).toHaveLength(1));

    await act(async () => {
      await result.current.remove('pk-1');
    });
    expect(result.current.passkeys).toHaveLength(0);
  });
});
