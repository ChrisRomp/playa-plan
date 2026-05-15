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
 *
 * For E2E testing:
 *   - Use Stripe test keys (pk_test_..., sk_test_...). Test cards are documented at
 *     https://docs.stripe.com/testing — common ones used by the suite:
 *       4242 4242 4242 4242  → success
 *       4000 0000 0000 0002  → generic decline
 *       4000 0000 0000 9995  → insufficient funds
 *       4000 0025 0000 3155  → 3DS challenge then success
 *   - Set `emailEnabled: false` so tests don't send mail; the dev login code is
 *     always 123456.
 *   - Optionally use PayPal sandbox creds.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLocalConfig() {
  console.log('Starting local configuration seed...');

  try {
    // Update core configuration with local/test values
    const coreConfig = await prisma.coreConfig.findFirst();
    if (coreConfig) {
      await prisma.coreConfig.update({
        where: { id: coreConfig.id },
        data: {
          // ---- Stripe (TEST mode keys only — they start with pk_test_ / sk_test_) ----
          stripeEnabled: true,
          stripePublicKey: 'pk_test_REPLACE_ME',
          stripeApiKey: 'sk_test_REPLACE_ME',

          // ---- PayPal sandbox (optional) ----
          paypalEnabled: false,
          paypalClientId: '',
          paypalClientSecret: '',
          paypalMode: 'SANDBOX',

          // ---- Email: keep OFF for E2E so tests don't trigger SMTP ----
          emailEnabled: false,
          smtpHost: 'localhost',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: '',
          smtpPassword: '',
          senderEmail: 'noreply@example.playaplan.local',
          senderName: 'Playa Plan E2E',

          // ---- Other dev defaults ----
          allowDeferredDuesPayment: true,
        },
      });
      console.log('✅ Updated core configuration with local values');
    } else {
      console.warn('⚠️  No coreConfig row found — run `npm run seed:dev` first.');
    }

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