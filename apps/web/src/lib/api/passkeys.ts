import { z } from 'zod';
import { api, setJwtToken, AuthResponseSchema, type AuthResponse } from '../api';

/**
 * Public-safe view of a registered passkey, mirroring the API's
 * PasskeyResponseDto. Sensitive fields (credentialId, publicKey,
 * webAuthnUserID, counter) are intentionally excluded.
 */
export const PasskeySchema = z.object({
  id: z.string(),
  nickname: z.string(),
  transports: z.array(z.string()).default([]),
  backedUp: z.boolean(),
  deviceType: z.string().nullable(),
  lastUsedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type Passkey = z.infer<typeof PasskeySchema>;

/**
 * Detect whether the current browser supports the modal WebAuthn flows we use.
 *
 * We deliberately do NOT require `isConditionalMediationAvailable` because we
 * use `startAuthentication()` / `startRegistration()` (modal pickers), not
 * conditional UI / browser autofill. Gating on conditional mediation hides
 * the feature on browsers where it would otherwise work fine.
 */
export const isPasskeySupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.PublicKeyCredential === 'function';
};

export const passkeysApi = {
  /** Fetch all passkeys belonging to the current user. */
  list: async (): Promise<Passkey[]> => {
    const res = await api.get<unknown[]>('/passkeys');
    return z.array(PasskeySchema).parse(res.data);
  },

  /** Begin enrollment: server returns options to feed to startRegistration. */
  registrationOptions: async (): Promise<unknown> => {
    const res = await api.post('/passkeys/registration/options');
    return res.data;
  },

  /** Submit the browser-supplied attestation back for verification. */
  registrationVerify: async (response: unknown, nickname: string): Promise<Passkey> => {
    const res = await api.post('/passkeys/registration/verify', { response, nickname });
    return PasskeySchema.parse(res.data);
  },

  /** Rename a passkey. */
  rename: async (id: string, nickname: string): Promise<Passkey> => {
    const res = await api.patch(`/passkeys/${id}`, { nickname });
    return PasskeySchema.parse(res.data);
  },

  /** Delete a passkey. */
  remove: async (id: string): Promise<void> => {
    await api.delete(`/passkeys/${id}`);
  },

  /** Begin discoverable login: returns auth options for startAuthentication. */
  authenticationOptions: async (): Promise<unknown> => {
    const res = await api.post('/auth/passkey/options');
    return res.data;
  },

  /**
   * Submit a browser-supplied assertion. On success, persists the
   * returned JWT exactly the same way the email-code flow does so the
   * existing AuthContext continues to work unchanged.
   */
  authenticationVerify: async (response: unknown): Promise<AuthResponse> => {
    const res = await api.post('/auth/passkey/verify', { response });
    const parsed = AuthResponseSchema.parse(res.data);
    if (parsed.accessToken) {
      setJwtToken(parsed.accessToken);
    }
    return parsed;
  },
};
