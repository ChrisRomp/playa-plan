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
const ACTIVE_REPORT_USER_EMAIL = 'e2e-admin@test.playaplan.local';
const INACTIVE_REPORT_USER_EMAIL = 'e2e-staff@test.playaplan.local';
const ACTIVE_REPORT_FIELD_NAME = 'Camping Footprint';
const INACTIVE_REPORT_OPTION_NAME = 'RV Camping';
const INACTIVE_REPORT_FIELD_NAME = 'Vehicle Length';
const ACTIVE_REPORT_FIELD_VALUE = '20 by 30 feet';
const INACTIVE_REPORT_FIELD_VALUE = '24 feet';
const HISTORICAL_REPORT_FIELD_VALUE = '22 feet in prior year';

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
  const activeReportUser = await prisma.user.findUniqueOrThrow({
    where: { email: ACTIVE_REPORT_USER_EMAIL },
  });
  const inactiveReportUser = await prisma.user.findUniqueOrThrow({
    where: { email: INACTIVE_REPORT_USER_EMAIL },
  });
  const activeReportOption = await findActiveReportCampingOption();
  const inactiveReportOption = await findOrCreateInactiveReportCampingOption();

  await upsertReportFieldValue({
    userId: activeReportUser.id,
    year: currentConfig.registrationYear,
    reportOption: activeReportOption,
    value: ACTIVE_REPORT_FIELD_VALUE,
  });
  await upsertReportFieldValue({
    userId: inactiveReportUser.id,
    year: currentConfig.registrationYear,
    reportOption: inactiveReportOption,
    value: INACTIVE_REPORT_FIELD_VALUE,
  });
  await upsertReportFieldValue({
    userId: inactiveReportUser.id,
    year: currentConfig.registrationYear - 1,
    reportOption: inactiveReportOption,
    value: HISTORICAL_REPORT_FIELD_VALUE,
  });

  console.log('✅ Created mixed active/inactive registration report field values');
}

interface ReportOptionField {
  campingOptionId: string;
  fieldId: string;
}

interface UpsertReportFieldValueInput {
  userId: string;
  year: number;
  reportOption: ReportOptionField;
  value: string;
}

async function findActiveReportCampingOption(): Promise<ReportOptionField> {
  const campingOption = await prisma.campingOption.findFirstOrThrow({
    where: {
      enabled: true,
      fields: {
        some: {
          displayName: ACTIVE_REPORT_FIELD_NAME,
        },
      },
    },
  });
  const reportField = await prisma.campingOptionField.findFirstOrThrow({
    where: {
      campingOptionId: campingOption.id,
      displayName: ACTIVE_REPORT_FIELD_NAME,
    },
  });

  return {
    campingOptionId: campingOption.id,
    fieldId: reportField.id,
  };
}

async function findOrCreateInactiveReportCampingOption(): Promise<ReportOptionField> {
  let campingOption = await prisma.campingOption.findFirst({
    where: { name: INACTIVE_REPORT_OPTION_NAME },
  });

  if (campingOption) {
    campingOption = await prisma.campingOption.update({
      where: { id: campingOption.id },
      data: {
        description: 'RV camping option used by report E2E coverage',
        enabled: false,
      },
    });
  } else {
    campingOption = await prisma.campingOption.create({
      data: {
        name: INACTIVE_REPORT_OPTION_NAME,
        description: 'RV camping option used by report E2E coverage',
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
      displayName: INACTIVE_REPORT_FIELD_NAME,
    },
  });

  if (!reportField) {
    reportField = await prisma.campingOptionField.create({
      data: {
        campingOptionId: campingOption.id,
        displayName: INACTIVE_REPORT_FIELD_NAME,
        dataType: 'STRING',
        required: true,
        order: 1,
      },
    });
  }

  return {
    campingOptionId: campingOption.id,
    fieldId: reportField.id,
  };
}

async function upsertReportFieldValue(
  input: UpsertReportFieldValueInput,
): Promise<void> {
  const registration = await findOrCreateReportRegistration(
    input.userId,
    input.year,
  );
  const campingRegistration = await prisma.campingOptionRegistration.upsert({
    where: {
      registrationId_campingOptionId: {
        registrationId: registration.id,
        campingOptionId: input.reportOption.campingOptionId,
      },
    },
    create: {
      userId: input.userId,
      registrationId: registration.id,
      campingOptionId: input.reportOption.campingOptionId,
    },
    update: {
      userId: input.userId,
    },
  });
  const existingFieldValue = await prisma.campingOptionFieldValue.findFirst({
    where: {
      registrationId: campingRegistration.id,
      fieldId: input.reportOption.fieldId,
    },
  });

  if (existingFieldValue) {
    await prisma.campingOptionFieldValue.update({
      where: { id: existingFieldValue.id },
      data: { value: input.value },
    });
    return;
  }

  await prisma.campingOptionFieldValue.create({
    data: {
      registrationId: campingRegistration.id,
      fieldId: input.reportOption.fieldId,
      value: input.value,
    },
  });
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
