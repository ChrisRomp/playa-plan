import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import {
  passkeysApi,
  isPasskeySupported,
  type Passkey,
} from '../lib/api/passkeys';

/**
 * Hook to load and manage the current user's passkeys.
 *
 * Wraps the browser WebAuthn ceremony and the API client so consumers
 * can register, rename, and delete without needing to know about
 * `@simplewebauthn/browser` directly.
 */
export const usePasskeys = () => {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isPasskeySupported();

  const load = useCallback(async () => {
    if (!supported) return;
    setIsLoading(true);
    setError(null);
    try {
      setPasskeys(await passkeysApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passkeys');
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    load();
  }, [load]);

  const register = useCallback(
    async (nickname?: string): Promise<Passkey | null> => {
      if (!supported) {
        setError('This browser does not support passkeys.');
        return null;
      }
      setError(null);
      try {
        const optionsJSON = (await passkeysApi.registrationOptions()) as Parameters<
          typeof startRegistration
        >[0]['optionsJSON'];
        const credential = await startRegistration({ optionsJSON });
        const created = await passkeysApi.registrationVerify(credential, nickname);
        setPasskeys((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Passkey registration failed';
        setError(msg);
        return null;
      }
    },
    [supported],
  );

  const rename = useCallback(async (id: string, nickname: string) => {
    setError(null);
    try {
      const updated = await passkeysApi.rename(id, nickname);
      setPasskeys((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename passkey');
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await passkeysApi.remove(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove passkey');
      return false;
    }
  }, []);

  return {
    passkeys,
    isLoading,
    error,
    supported,
    refresh: load,
    register,
    rename,
    remove,
  };
};

// The discoverable passkey login ceremony lives on AuthContext.loginWithPasskey()
// because completing a login also has to update cookie state, isAuthenticated,
// and the user record. A hook that returns just the AuthResponse would be a
// footgun (token persisted, app state still unauthenticated).
