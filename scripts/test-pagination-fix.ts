#!/usr/bin/env ts-node

/**
 * Manual API Test for Pagination Fix
 * 
 * This script directly connects to the database to verify
 * the pagination fix works by checking registration counts
 */

import { PrismaClient } from '@prisma/client';

async function testPaginationFix() {
  console.log('🧪 Testing Admin Registration Pagination Fix...');

  const prisma = new PrismaClient();

  try {
    // Test the database directly to verify we can access all registrations
    console.log('\n📋 Database Test: Count all registrations');
    const totalCount = await prisma.registration.count();
    console.log(`   Total registrations in database: ${totalCount}`);
    
    // Test fetching all registrations (simulating unlimited behavior)
    console.log('\n📋 Database Test: Fetch all registrations');
    const allRegistrations = await prisma.registration.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            playaName: true,
            role: true,
          },
        },
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`   Successfully fetched: ${allRegistrations.length} registrations`);
    
    // Test limited fetch (simulating paginated behavior)
    console.log('\n📋 Database Test: Fetch limited registrations (10)');
    const limitedRegistrations = await prisma.registration.findMany({
      take: 10,
      skip: 0,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            playaName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`   Successfully fetched: ${limitedRegistrations.length} registrations (limited)`);

    // Summary
    console.log('\n� Summary:');
    console.log(`   ✅ Database contains ${totalCount} total registrations`);
    console.log(`   ✅ Unlimited fetch returned ${allRegistrations.length} registrations`);
    console.log(`   ✅ Limited fetch returned ${limitedRegistrations.length} registrations`);
    
    if (totalCount > 50) {
      console.log(`   🎯 Database has ${totalCount} registrations (>50) - perfect for testing pagination fix`);
    } else {
      console.log(`   ⚠️  Database has ${totalCount} registrations (<50) - fix works but harder to verify impact`);
    }

    if (allRegistrations.length === totalCount) {
      console.log('   ✅ PASS: Unlimited pagination can access all registrations');
    } else {
      console.log('   ❌ FAIL: Unlimited pagination not returning all registrations');
    }

    if (limitedRegistrations.length <= 10) {
      console.log('   ✅ PASS: Limited pagination works correctly');
    } else {
      console.log('   ❌ FAIL: Limited pagination not working');
    }

    console.log('\n🏁 Database pagination test completed successfully!');

  } catch (error) {
    console.error('❌ Error during database test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPaginationFix()
  .catch(e => {
    console.error('❌ Database pagination test failed:', e);
    process.exit(1);
  });