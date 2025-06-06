#!/usr/bin/env ts-node

/**
 * Local Development Seed
 * 
 * This file contains local development configuration and test data.
 * It should NOT be committed to git and can contain secrets/API keys.
 * 
 * Copy this to seed.local.ts and customize with your local values.
 * 
 * Usage:
 *   npm run seed:local
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLocalConfig() {
  console.log('Starting local configuration seed...');

  try {
    // Example: Update core configuration with local/test values
    const coreConfig = await prisma.coreConfig.findFirst();
    if (coreConfig) {
      await prisma.coreConfig.update({
        where: { id: coreConfig.id },
        data: {
          // Example local configuration - customize these values
          stripePublicKey: 'pk_test_your_local_stripe_key_here',
          stripeApiKey: 'sk_test_your_local_stripe_secret_key_here',
          smtpHost: 'smtp.sendgrid.net',
          smtpPort: 587,
          smtpUser: 'apikey',
          smtpPassword: 'SG.your_local_sendgrid_key_here',
          senderEmail: 'test@example.com',
          senderName: 'Playa Plan Dev',
          emailEnabled: true,
          stripeEnabled: true,
          // Add other configuration you need for local development
        },
      });
      console.log('✅ Updated core configuration with local values');
    }

    // Create test users with known credentials (useful for development)
    // const testUsers = [
    //   {
    //     email: 'admin@test.local',
    //     firstName: 'Test',
    //     lastName: 'Admin',
    //     phone: '555-0101',
    //     password: '$2b$10$K7L/VNE7YrG9R8k2/UWz4uGYN8pFkZGpZ1X2wjCrK9cPFY4Z5TYqW', // bcrypt hash of "password123"
    //     isAdmin: true,
    //     emailVerified: true,
    //   },
    //   {
    //     email: 'user@test.local',
    //     firstName: 'Test',
    //     lastName: 'User',
    //     phone: '555-0102',
    //     password: '$2b$10$K7L/VNE7YrG9R8k2/UWz4uGYN8pFkZGpZ1X2wjCrK9cPFY4Z5TYqW', // bcrypt hash of "password123"
    //     isAdmin: false,
    //     emailVerified: true,
    //   },
    // ];

    // for (const userData of testUsers) {
    //   const existingUser = await prisma.user.findUnique({
    //     where: { email: userData.email },
    //   });

    //   if (!existingUser) {
    //     await prisma.user.create({ data: userData });
    //     console.log(`✅ Created test user: ${userData.email} (password: password123)`);
    //   } else {
    //     console.log(`ℹ️  Test user already exists: ${userData.email}`);
    //   }
    // }

    console.log('✅ Local configuration seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding local configuration:', error);
    throw error;
  }
}

// Handle command line execution
if (require.main === module) {
  seedLocalConfig()
    .then(() => {
      console.log('Local seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Local seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedLocalConfig }; 