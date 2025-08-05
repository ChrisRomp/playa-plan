import { PrismaClient, RegistrationStatus } from '@prisma/client';

/**
 * Test Data Generator for Pagination Testing
 * Creates enough registrations to test pagination behavior (>50 records)
 * 
 * This utility can be used by:
 * 1. Manual testing via CLI: `ts-node apps/api/test/helpers/pagination-test-data.ts`
 * 2. E2E tests that need large datasets
 * 3. Development environment setup
 */
export async function generatePaginationTestData(prisma: PrismaClient, targetCount = 75) {
  console.log('🚀 Generating test registrations for pagination test...');

  try {
    // Check how many registrations currently exist
    const existingCount = await prisma.registration.count();
    console.log(`📊 Current registrations: ${existingCount}`);

    const neededCount = Math.max(0, targetCount - existingCount);

    if (neededCount === 0) {
      console.log(`✅ Already have ${existingCount} registrations (>= ${targetCount}), pagination test data is ready!`);
      return { created: 0, total: existingCount };
    }

    console.log(`📝 Need to create ${neededCount} more registrations to reach ${targetCount} total`);

    // Get the default camp year and any existing job categories
    const currentYear = new Date().getFullYear();
    
    // Find existing jobs to assign to registrations
    const jobs = await prisma.job.findMany({ take: 5 });
    if (jobs.length === 0) {
      console.log('⚠️  No jobs found. Please run the main seed script first.');
      throw new Error('No jobs available for test data generation');
    }

    let createdCount = 0;

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
            isEmailVerified: true,
          },
        });

        // Create a registration for this user
        const registration = await prisma.registration.create({
          data: {
            userId: user.id,
            year: currentYear,
            status: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING, RegistrationStatus.WAITLISTED][userIndex % 3],
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

        createdCount++;
      }
    }

    const finalCount = await prisma.registration.count();
    console.log(`✅ Test data generation complete!`);
    console.log(`📊 Created: ${createdCount} registrations`);
    console.log(`📊 Total registrations: ${finalCount}`);
    console.log(`🎯 Pagination fix can now be tested with ${finalCount} registrations (target: >${targetCount})`);

    return { created: createdCount, total: finalCount };

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  }
}

/**
 * Clean up test pagination data
 * Removes users with @pagination.test emails
 */
export async function cleanupPaginationTestData(prisma: PrismaClient) {
  console.log('🧹 Cleaning up pagination test data...');
  
  try {
    // Find and delete test users (this will cascade to registrations)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@pagination.test'
        }
      }
    });

    console.log(`✅ Cleaned up ${deletedUsers.count} test users and their registrations`);
    return deletedUsers.count;
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    throw error;
  }
}

// CLI runner (only execute if called directly)
if (require.main === module) {
  const prisma = new PrismaClient();
  
  async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'generate';
    const count = parseInt(args[1]) || 75;

    switch (command) {
      case 'generate':
        await generatePaginationTestData(prisma, count);
        break;
      case 'cleanup':
        await cleanupPaginationTestData(prisma);
        break;
      default:
        console.log('Usage:');
        console.log('  generate [count]  - Generate test data (default: 75)');
        console.log('  cleanup          - Clean up test data');
        console.log('');
        console.log('Examples:');
        console.log('  ts-node apps/api/test/helpers/pagination-test-data.ts generate 100');
        console.log('  ts-node apps/api/test/helpers/pagination-test-data.ts cleanup');
        break;
    }
  }

  main()
    .catch(e => {
      console.error('❌ Pagination test data operation failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
