#!/usr/bin/env ts-node

/**
 * Pagination Test Data Generator
 * 
 * Creates test registrations to verify the pagination fix
 * This generates more than 50 registrations to test the unlimited pagination
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateTestRegistrations() {
  console.log('🚀 Generating test registrations for pagination test...');

  try {
    // Check how many registrations currently exist
    const existingCount = await prisma.registration.count();
    console.log(`📊 Current registrations: ${existingCount}`);

    // Target is to have at least 75 registrations to test the >50 limit
    const targetCount = 75;
    const neededCount = Math.max(0, targetCount - existingCount);

    if (neededCount === 0) {
      console.log(`✅ Already have ${existingCount} registrations (>= ${targetCount}), pagination test data is ready!`);
      return;
    }

    console.log(`📝 Need to create ${neededCount} more registrations to reach ${targetCount} total`);

    // Get the default camp year and any existing job categories
    const currentYear = new Date().getFullYear();
    
    // Find existing jobs to assign to registrations
    const jobs = await prisma.job.findMany({ take: 5 });
    if (jobs.length === 0) {
      console.log('⚠️  No jobs found. Please run the main seed script first.');
      return;
    }

    // Create test users and registrations
    const batchSize = 10;
    for (let i = 0; i < neededCount; i += batchSize) {
      const batch = Math.min(batchSize, neededCount - i);
      console.log(`Creating batch ${Math.floor(i / batchSize) + 1}: ${batch} registrations...`);

      for (let j = 0; j < batch; j++) {
        const userIndex = existingCount + i + j + 1;
        
        // Create a test user
        const user = await prisma.user.create({
          data: {
            email: `testuser${userIndex}@pagination.test`,
            firstName: `Test${userIndex}`,
            lastName: 'User',
            playaName: `TestUser${userIndex}`,
            role: 'PARTICIPANT',
            email_verified: true,
          },
        });

        // Create a registration for this user
        const registration = await prisma.registration.create({
          data: {
            userId: user.id,
            year: currentYear,
            status: ['CONFIRMED', 'PENDING', 'WAITLISTED'][userIndex % 3] as any,
          },
        });

        // Assign a random job to this registration
        const randomJob = jobs[userIndex % jobs.length];
        await prisma.registrationJob.create({
          data: {
            registrationId: registration.id,
            jobId: randomJob.id,
          },
        });
      }
    }

    const finalCount = await prisma.registration.count();
    console.log(`✅ Test data generation complete!`);
    console.log(`📊 Total registrations: ${finalCount}`);
    console.log(`🎯 Pagination fix can now be tested with ${finalCount} registrations (target: >${targetCount})`);

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  }
}

generateTestRegistrations()
  .catch(e => {
    console.error('❌ Pagination test data generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });