/**
 * Canonical personas seeded by `seed.e2e.ts`. Tests reference these emails to log in
 * as a known role; the actual storage-state files are produced by `auth.setup.ts`.
 *
 * Per-test users (e.g. for registration flows where state matters) are still created
 * on the fly via the API with a TEST_EMAIL_PREFIX (see runId.ts) so tests stay
 * parallel-safe.
 */
export const PERSONAS = {
  admin: {
    email: 'e2e-admin@test.playaplan.local',
    role: 'ADMIN' as const,
    firstName: 'E2E',
    lastName: 'Admin',
  },
  staff: {
    email: 'e2e-staff@test.playaplan.local',
    role: 'STAFF' as const,
    firstName: 'E2E',
    lastName: 'Staff',
  },
  participant: {
    email: 'e2e-participant@test.playaplan.local',
    role: 'PARTICIPANT' as const,
    firstName: 'E2E',
    lastName: 'Participant',
  },
  participantDeferred: {
    email: 'e2e-participant-deferred@test.playaplan.local',
    role: 'PARTICIPANT' as const,
    firstName: 'E2E',
    lastName: 'Deferred',
    flags: { allowDeferredDuesPayment: true },
  },
  participantNoJob: {
    email: 'e2e-participant-no-job@test.playaplan.local',
    role: 'PARTICIPANT' as const,
    firstName: 'E2E',
    lastName: 'NoJob',
    flags: { allowNoJob: true },
  },
  participantEarly: {
    email: 'e2e-participant-early@test.playaplan.local',
    role: 'PARTICIPANT' as const,
    firstName: 'E2E',
    lastName: 'Early',
    flags: { allowEarlyRegistration: true },
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;
