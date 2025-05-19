import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Try to get a count from the table - if it doesn't exist, it will throw an error
    await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${tableName}"`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Starting database seed...');

  // Clean up existing data (in reverse order to respect foreign key constraints)
  console.log('Checking and cleaning up existing data...');
  
  if (await tableExists('notifications')) {
    await prisma.notification.deleteMany({});
    console.log('Cleaned notifications table');
  }
  
  if (await tableExists('payments')) {
    await prisma.payment.deleteMany({});
    console.log('Cleaned payments table');
  }
  
  if (await tableExists('registrations')) {
    await prisma.registration.deleteMany({});
    console.log('Cleaned registrations table');
  }
  
  if (await tableExists('shifts')) {
    await prisma.shift.deleteMany({});
    console.log('Cleaned shifts table');
  }
  
  if (await tableExists('jobs')) {
    await prisma.job.deleteMany({});
    console.log('Cleaned jobs table');
  }
  
  if (await tableExists('job_categories')) {
    await prisma.jobCategory.deleteMany({});
    console.log('Cleaned job_categories table');
  }
  
  // Camp entity has been removed
  
  if (await tableExists('users')) {
    await prisma.user.deleteMany({});
    console.log('Cleaned users table');
  }
  
  console.log('Successfully completed data cleanup');

  // Create users
  console.log(`Created ${await prisma.user.count()} users`);

  // Camp entity has been removed
  console.log('Camp entity has been removed from the schema');

  // Create job categories
  const kitchenCategory = await prisma.jobCategory.create({
    data: {
      name: 'KITCHEN',
      description: 'Food preparation and kitchen related work'
    }
  });

  const greeterCategory = await prisma.jobCategory.create({
    data: {
      name: 'GREETER',
      description: 'Welcoming and orienting participants'
    }
  });

  const sanitationCategory = await prisma.jobCategory.create({
    data: {
      name: 'SANITATION',
      description: 'Cleaning and waste management'
    }
  });

  const constructionCategory = await prisma.jobCategory.create({
    data: {
      name: 'CONSTRUCTION',
      description: 'Building and construction work'
    }
  });

  // This category is created for future use
  await prisma.jobCategory.create({
    data: {
      name: 'ART',
      description: 'Art installations and creative projects'
    }
  });

  console.log(`Created ${await prisma.jobCategory.count()} job categories`);

  // Create shifts
  console.log('Creating shifts...');

  const afternoonKitchenShift = await prisma.shift.create({
    data: {
      name: 'Afternoon Kitchen',
      description: 'Afternoon kitchen shift',
      startTime: '12:00',
      endTime: '16:00',
      dayOfWeek: 'TUESDAY',
      jobs: { create: [] }
    },
  });

  const morningGreeterShift = await prisma.shift.create({
    data: {
      name: 'Morning Greeter',
      description: 'Morning shift for greeting',
      startTime: '09:00',
      endTime: '13:00',
      dayOfWeek: 'TUESDAY',
      jobs: { create: [] }
    },
  });

  const closingSundayShift = await prisma.shift.create({
    data: {
      name: 'Closing Sunday',
      description: 'Camp tear down',
      startTime: '10:00',
      endTime: '14:00',
      dayOfWeek: 'CLOSING_SUNDAY',
      jobs: { create: [] }
    },
  });

  const preOpeningShift = await prisma.shift.create({
    data: {
      name: 'Pre-Opening Setup',
      description: 'Early camp setup',
      startTime: '10:00',
      endTime: '16:00',
      dayOfWeek: 'PRE_OPENING',
      jobs: { create: [] }
    },
  });
  
  console.log(`Created ${await prisma.shift.count()} shifts`);

  // Create jobs (after shifts)
  // Create afternoon kitchen job for shift coverage
  await prisma.job.create({
    data: {
      name: 'Afternoon Kitchen Helper',
      description: 'Assist with meal preparation and cleanup during afternoon',
      categoryId: kitchenCategory.id,
      location: 'Main Camp Kitchen',
      shiftId: afternoonKitchenShift.id,
      maxRegistrations: 4
    }
  });

  // Create greeter job for entrance coverage
  await prisma.job.create({
    data: {
      name: 'Camp Greeter',
      description: 'Welcome new arrivals and help with orientation',
      categoryId: greeterCategory.id,
      location: 'Main Entrance',
      shiftId: morningGreeterShift.id,
      maxRegistrations: 2
    }
  });

  // Create sanitation job for camp cleanup
  await prisma.job.create({
    data: {
      name: 'Cleanup Crew',
      description: 'Help break down and clean the camp',
      categoryId: sanitationCategory.id,
      location: 'Entire Camp',
      shiftId: closingSundayShift.id,
      maxRegistrations: 6
    }
  });

  // Create construction job for build/strike phases
  await prisma.job.create({
    data: {
      name: 'Setup Crew',
      description: 'Help set up the camp infrastructure',
      categoryId: constructionCategory.id,
      location: 'Main Camp Area',
      shiftId: preOpeningShift.id,
      maxRegistrations: 8
    }
  });

  console.log(`Created ${await prisma.job.count()} jobs`);

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('Error while seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });