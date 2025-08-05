#!/usr/bin/env ts-node

/**
 * Manual API Test for Pagination Fix
 * 
 * This script directly tests the registration admin service to verify
 * the pagination fix works correctly
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationAdminService } from '../apps/api/src/registrations/services/registration-admin.service';
import { PrismaService } from '../apps/api/src/common/prisma/prisma.service';
import { AdminAuditService } from '../apps/api/src/admin-audit/services/admin-audit.service';
import { AdminNotificationsService } from '../apps/api/src/notifications/services/admin-notifications.service';
import { RegistrationCleanupService } from '../apps/api/src/registrations/services/registration-cleanup.service';
import { PaymentsService } from '../apps/api/src/payments/services/payments.service';

async function testPaginationFix() {
  console.log('🧪 Testing Admin Registration Pagination Fix...');

  // Create a test module with the real service and a real PrismaService
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RegistrationAdminService,
      {
        provide: PrismaService,
        useValue: new PrismaService(), // Use real PrismaService for this test
      },
      {
        provide: AdminAuditService,
        useValue: {
          createAuditRecord: jest.fn(),
          createMultipleAuditRecords: jest.fn(),
          getAuditTrail: jest.fn(),
        },
      },
      {
        provide: AdminNotificationsService,
        useValue: {
          sendRegistrationModificationNotification: jest.fn(),
          sendRegistrationCancellationNotification: jest.fn(),
        },
      },
      {
        provide: RegistrationCleanupService,
        useValue: {
          cleanupRegistration: jest.fn(),
        },
      },
      {
        provide: PaymentsService,
        useValue: {
          processRefund: jest.fn(),
        },
      },
    ],
  }).compile();

  const service = module.get<RegistrationAdminService>(RegistrationAdminService);
  const prisma = module.get<PrismaService>(PrismaService);

  try {
    // Test 1: Default behavior (no limit specified) should return unlimited results
    console.log('\n📋 Test 1: Default unlimited behavior');
    const result1 = await service.getRegistrations({});
    console.log(`   Total registrations: ${result1.total}`);
    console.log(`   Returned: ${result1.registrations.length}`);
    console.log(`   Limit: ${result1.limit}`);
    console.log(`   Pages: ${result1.totalPages}`);
    
    // Verify: limit should be 0 and all records should be returned
    if (result1.limit === 0 && result1.registrations.length === result1.total) {
      console.log('   ✅ PASS: Unlimited pagination works correctly');
    } else {
      console.log('   ❌ FAIL: Unlimited pagination not working');
    }

    // Test 2: Explicit limit=0 should also return unlimited results
    console.log('\n📋 Test 2: Explicit limit=0');
    const result2 = await service.getRegistrations({ limit: 0 });
    console.log(`   Total registrations: ${result2.total}`);
    console.log(`   Returned: ${result2.registrations.length}`);
    console.log(`   Limit: ${result2.limit}`);
    
    if (result2.limit === 0 && result2.registrations.length === result2.total) {
      console.log('   ✅ PASS: Explicit limit=0 works correctly');
    } else {
      console.log('   ❌ FAIL: Explicit limit=0 not working');
    }

    // Test 3: Explicit limit (e.g., 10) should still work for pagination
    console.log('\n📋 Test 3: Explicit limit=10 for pagination');
    const result3 = await service.getRegistrations({ limit: 10, page: 1 });
    console.log(`   Total registrations: ${result3.total}`);
    console.log(`   Returned: ${result3.registrations.length}`);
    console.log(`   Limit: ${result3.limit}`);
    console.log(`   Page: ${result3.page}`);
    console.log(`   Total Pages: ${result3.totalPages}`);
    
    if (result3.limit === 10 && result3.registrations.length <= 10) {
      console.log('   ✅ PASS: Explicit pagination still works');
    } else {
      console.log('   ❌ FAIL: Explicit pagination broken');
    }

    // Summary
    console.log('\n📊 Summary:');
    if (result1.total > 50) {
      console.log(`   🎯 Dataset has ${result1.total} registrations (>50) - perfect for testing pagination fix`);
    } else {
      console.log(`   ⚠️  Dataset has ${result1.total} registrations (<50) - fix works but harder to verify impact`);
    }

    console.log('\n🏁 Manual API test completed successfully!');

  } catch (error) {
    console.error('❌ Error during API test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await module.close();
  }
}

// Run the test
testPaginationFix()
  .catch(e => {
    console.error('❌ Manual API test failed:', e);
    process.exit(1);
  });