#!/usr/bin/env ts-node

/**
 * E2E persona seed.
 *
 * Idempotently creates the canonical test users referenced by tests/helpers/personas.ts.
 * Safe to commit — contains no secrets. Run after `seed.ts` (which creates the base
 * camp data) and before `seed.local.ts` (which injects payment/email creds).
 *
 * Usage:
 *   npm run seed:e2e
 *
 * Re-running is a no-op for users that already exist; flags are upserted.
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

interface PersonaSpec {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  flags?: {
    allowDeferredDuesPayment?: boolean;
    allowEarlyRegistration?: boolean;
    allowNoJob?: boolean;
  };
}

const PERSONAS: PersonaSpec[] = [
  { email: 'e2e-admin@test.playaplan.local', role: 'ADMIN', firstName: 'E2E', lastName: 'Admin' },
  { email: 'e2e-staff@test.playaplan.local', role: 'STAFF', firstName: 'E2E', lastName: 'Staff' },
  { email: 'e2e-participant@test.playaplan.local', role: 'PARTICIPANT', firstName: 'E2E', lastName: 'Participant' },
  {
    email: 'e2e-participant-deferred@test.playaplan.local',
    role: 'PARTICIPANT',
    firstName: 'E2E',
    lastName: 'Deferred',
    flags: { allowDeferredDuesPayment: true },
  },
  {
    email: 'e2e-participant-no-job@test.playaplan.local',
    role: 'PARTICIPANT',
    firstName: 'E2E',
    lastName: 'NoJob',
    flags: { allowNoJob: true },
  },
  {
    email: 'e2e-participant-early@test.playaplan.local',
    role: 'PARTICIPANT',
    firstName: 'E2E',
    lastName: 'Early',
    flags: { allowEarlyRegistration: true },
  },
];

async function upsertPersona(spec: PersonaSpec): Promise<void> {
  const data = {
    role: spec.role,
    firstName: spec.firstName,
    lastName: spec.lastName,
    isEmailVerified: true,
    allowDeferredDuesPayment: spec.flags?.allowDeferredDuesPayment ?? false,
    allowEarlyRegistration: spec.flags?.allowEarlyRegistration ?? false,
    allowNoJob: spec.flags?.allowNoJob ?? false,
  };

  await prisma.user.upsert({
    where: { email: spec.email },
    create: { email: spec.email, ...data },
    update: data,
  });
   
  console.log(`✅ persona ${spec.email} (${spec.role})`);
}

async function main(): Promise<void> {
   
  console.log('Seeding E2E personas...');
  for (const persona of PERSONAS) {
    await upsertPersona(persona);
  }
   
  console.log('E2E personas seed complete.');
}

main()
  .catch((err) => {
     
    console.error('seed.e2e.ts failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
