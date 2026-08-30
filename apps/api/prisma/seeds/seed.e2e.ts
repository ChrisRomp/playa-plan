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
const REPORT_USER_EMAIL = 'e2e-staff@test.playaplan.local';
const REPORT_OPTION_NAME = 'Archived E2E Camping';
const REPORT_FIELD_NAME = 'Camping Footprint';
const CURRENT_REPORT_FIELD_VALUE = 'Current year E2E camping footprint';
const HISTORICAL_REPORT_FIELD_VALUE = 'Historical E2E camping footprint';

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

  // Enable allowDeferredDuesPayment at the config level so tests covering the
  // deferred path can opt users in via the user-level flag. Without this, the
  // deferred path is unreachable regardless of user settings.
  const config = await prisma.coreConfig.findFirst();
  if (config && !config.allowDeferredDuesPayment) {
    await prisma.coreConfig.update({
      where: { id: config.id },
      data: { allowDeferredDuesPayment: true },
    });
    console.log('✅ Enabled allowDeferredDuesPayment on coreConfig');
  }

  // Seed prior-year registration data for testing year-scoped capacity.
  // This creates a CONFIRMED registration from the previous year for the admin
  // persona on a low-capacity job (maxRegistrations=1). Tests verify that
  // current-year registrations are not incorrectly waitlisted due to prior-year data.
  await seedPriorYearRegistration();
  await seedRegistrationReportData();

  console.log('E2E personas seed complete.');
}

/**
 * Create a prior-year CONFIRMED registration for the admin persona on a
 * 1-capacity job. This exercises the year-scoping logic: current-year
 * registrants for the same job should NOT be waitlisted because of this
 * prior-year entry.
 */
async function seedPriorYearRegistration(): Promise<void> {
  const currentConfig = await prisma.coreConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!currentConfig) {
    console.log('⚠️  No coreConfig found, skipping prior-year registration seed');
    return;
  }

  const priorYear = currentConfig.registrationYear - 1;
  const adminUser = await prisma.user.findUnique({
    where: { email: 'e2e-admin@test.playaplan.local' },
  });
  if (!adminUser) {
    console.log('⚠️  Admin persona not found, skipping prior-year registration seed');
    return;
  }

  // Find a 1-capacity, non-staff-only job to attach the prior-year registration to.
  const targetJob = await prisma.job.findFirst({
    where: {
      maxRegistrations: 1,
      category: { staffOnly: false },
    },
  });
  if (!targetJob) {
    console.log('⚠️  No 1-capacity non-staff job found, skipping prior-year registration seed');
    return;
  }

  // Idempotent: skip if the admin already has a registration for priorYear.
  const existing = await prisma.registration.findFirst({
    where: { userId: adminUser.id, year: priorYear },
  });
  if (existing) {
    console.log(`✅ Prior-year registration already exists (year=${priorYear}), skipping`);
    return;
  }

  await prisma.registration.create({
    data: {
      status: 'CONFIRMED',
      year: priorYear,
      user: { connect: { id: adminUser.id } },
      jobs: {
        create: [{ job: { connect: { id: targetJob.id } } }],
      },
    },
  });

  console.log(`✅ Created prior-year (${priorYear}) CONFIRMED registration for admin on job "${targetJob.name}"`);
}

/**
 * Create linked current- and prior-year camping field values used by the
 * registration report E2E coverage.
 */
async function seedRegistrationReportData(): Promise<void> {
  const currentConfig = await prisma.coreConfig.findFirstOrThrow({
    orderBy: { createdAt: 'desc' },
  });
  const reportUser = await prisma.user.findUniqueOrThrow({
    where: { email: REPORT_USER_EMAIL },
  });
  const reportCampingOption = await findOrCreateReportCampingOption();

  const reportYears = [
    {
      year: currentConfig.registrationYear,
      value: CURRENT_REPORT_FIELD_VALUE,
    },
    {
      year: currentConfig.registrationYear - 1,
      value: HISTORICAL_REPORT_FIELD_VALUE,
    },
  ];

  for (const reportYear of reportYears) {
    const registration = await findOrCreateReportRegistration(
      reportUser.id,
      reportYear.year,
    );
    const campingRegistration = await prisma.campingOptionRegistration.upsert({
      where: {
        registrationId_campingOptionId: {
          registrationId: registration.id,
          campingOptionId: reportCampingOption.campingOptionId,
        },
      },
      create: {
        userId: reportUser.id,
        registrationId: registration.id,
        campingOptionId: reportCampingOption.campingOptionId,
      },
      update: {
        userId: reportUser.id,
      },
    });
    const existingFieldValue = await prisma.campingOptionFieldValue.findFirst({
      where: {
        registrationId: campingRegistration.id,
        fieldId: reportCampingOption.fieldId,
      },
    });

    if (existingFieldValue) {
      await prisma.campingOptionFieldValue.update({
        where: { id: existingFieldValue.id },
        data: { value: reportYear.value },
      });
    } else {
      await prisma.campingOptionFieldValue.create({
        data: {
          registrationId: campingRegistration.id,
          fieldId: reportCampingOption.fieldId,
          value: reportYear.value,
        },
      });
    }
  }

  console.log('✅ Created current and historical registration report field values');
}

async function findOrCreateReportCampingOption(): Promise<{
  campingOptionId: string;
  fieldId: string;
}> {
  let campingOption = await prisma.campingOption.findFirst({
    where: { name: REPORT_OPTION_NAME },
  });

  if (campingOption) {
    campingOption = await prisma.campingOption.update({
      where: { id: campingOption.id },
      data: { enabled: false },
    });
  } else {
    campingOption = await prisma.campingOption.create({
      data: {
        name: REPORT_OPTION_NAME,
        description: 'Disabled camping option for report E2E coverage',
        enabled: false,
        workShiftsRequired: 0,
        participantDues: 0,
        staffDues: 0,
        maxSignups: 0,
      },
    });
  }

  let reportField = await prisma.campingOptionField.findFirst({
    where: {
      campingOptionId: campingOption.id,
      displayName: REPORT_FIELD_NAME,
    },
  });

  if (!reportField) {
    reportField = await prisma.campingOptionField.create({
      data: {
        campingOptionId: campingOption.id,
        displayName: REPORT_FIELD_NAME,
        dataType: 'MULTILINE_STRING',
        required: false,
        order: 0,
      },
    });
  }

  return {
    campingOptionId: campingOption.id,
    fieldId: reportField.id,
  };
}

async function findOrCreateReportRegistration(
  userId: string,
  year: number,
): Promise<{ id: string }> {
  const existingRegistration = await prisma.registration.findFirst({
    where: { userId, year },
    select: { id: true },
  });

  if (existingRegistration) {
    return existingRegistration;
  }

  return prisma.registration.create({
    data: {
      userId,
      year,
      status: 'CONFIRMED',
    },
    select: { id: true },
  });
}

main()
  .catch((err) => {
     
    console.error('seed.e2e.ts failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
