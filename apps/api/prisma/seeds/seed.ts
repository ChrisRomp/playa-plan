import { PrismaClient, UserRole, RegistrationStatus, PaymentStatus, PaymentProvider, NotificationType, NotificationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Try to get a count from the table - if it doesn't exist, it will throw an error
    await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${tableName}"`);
    return true;
  } catch (error) {
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
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example-camp.org',
      password: await hashPassword('AdminSecurePass123!'),
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isEmailVerified: true
    }
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@example-camp.org',
      password: await hashPassword('StaffSecurePass123!'),
      firstName: 'Staff',
      lastName: 'User',
      role: UserRole.STAFF,
      isEmailVerified: true
    }
  });

  const participantUser1 = await prisma.user.create({
    data: {
      email: 'participant1@example.com',
      password: await hashPassword('ParticipantPass123!'),
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.PARTICIPANT,
      isEmailVerified: true
    }
  });

  const participantUser2 = await prisma.user.create({
    data: {
      email: 'participant2@example.com',
      password: await hashPassword('ParticipantPass123!'),
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.PARTICIPANT,
      isEmailVerified: false,
      verificationToken: 'test-verification-token-123'
    }
  });

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

  const rangerCategory = await prisma.jobCategory.create({
    data: {
      name: 'RANGER',
      description: 'Safety and security related work'
    }
  });

  const medicalCategory = await prisma.jobCategory.create({
    data: {
      name: 'MEDICAL',
      description: 'Medical and first aid services'
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

  const artCategory = await prisma.jobCategory.create({
    data: {
      name: 'ART',
      description: 'Art installations and creative projects'
    }
  });

  const transportationCategory = await prisma.jobCategory.create({
    data: {
      name: 'TRANSPORTATION',
      description: 'Transportation and vehicle operations'
    }
  });

  const techCategory = await prisma.jobCategory.create({
    data: {
      name: 'TECH',
      description: 'Technical support and equipment management'
    }
  });

  const operationsCategory = await prisma.jobCategory.create({
    data: {
      name: 'OPERATIONS',
      description: 'General operations and logistics'
    }
  });

  const otherCategory = await prisma.jobCategory.create({
    data: {
      name: 'OTHER',
      description: 'Miscellaneous jobs that don\'t fit other categories'
    }
  });

  console.log(`Created ${await prisma.jobCategory.count()} job categories`);

  // Create shifts
  console.log('Creating shifts...');
  
  // Create shifts first
  const morningKitchenShift = await prisma.shift.create({
    data: {
      name: 'Morning Kitchen',
      description: 'Morning kitchen shift',
      startTime: '08:00',
      endTime: '12:00',
      dayOfWeek: 'TUESDAY',
      jobs: { create: [] }
    },
  });

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

  const nightRangerShift = await prisma.shift.create({
    data: {
      name: 'Night Ranger',
      description: 'Night patrol and safety',
      startTime: '20:00',
      endTime: '02:00',
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
  const kitchenJob = await prisma.job.create({
    data: {
      name: 'Kitchen Helper',
      description: 'Assist with meal preparation and cleanup',
      categoryId: kitchenCategory.id,
      location: 'Main Camp Kitchen',
      shiftId: morningKitchenShift.id,
      maxRegistrations: 4
    }
  });

  const afternoonKitchenJob = await prisma.job.create({
    data: {
      name: 'Afternoon Kitchen Helper',
      description: 'Assist with meal preparation and cleanup during afternoon',
      categoryId: kitchenCategory.id,
      location: 'Main Camp Kitchen',
      shiftId: afternoonKitchenShift.id,
      maxRegistrations: 4
    }
  });

  const greeterJob = await prisma.job.create({
    data: {
      name: 'Camp Greeter',
      description: 'Welcome new arrivals and help with orientation',
      categoryId: greeterCategory.id,
      location: 'Main Entrance',
      shiftId: morningGreeterShift.id,
      maxRegistrations: 2
    }
  });

  const rangerJob = await prisma.job.create({
    data: {
      name: 'Night Ranger',
      description: 'Patrol the camp during night hours',
      categoryId: rangerCategory.id,
      location: 'All Camp Areas',
      shiftId: nightRangerShift.id,
      maxRegistrations: 3
    }
  });

  const sanitationJob = await prisma.job.create({
    data: {
      name: 'Cleanup Crew',
      description: 'Help break down and clean the camp',
      categoryId: sanitationCategory.id,
      location: 'Entire Camp',
      shiftId: closingSundayShift.id,
      maxRegistrations: 6
    }
  });

  const constructionJob = await prisma.job.create({
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

  // Create a registration with payment
  const payment = await prisma.payment.create({
    data: {
      amount: 50.0,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.STRIPE,
      providerRefId: 'stripe_test_payment_123',
      userId: participantUser1.id
    }
  });

  const registration = await prisma.registration.create({
    data: {
      status: RegistrationStatus.CONFIRMED,
      userId: participantUser1.id,
      jobId: kitchenJob.id,
      paymentId: payment.id
    }
  });

  console.log(`Created registration for user ${participantUser1.firstName} ${participantUser1.lastName} for ${kitchenJob.name} job`);
  
  // Create another registration without payment
  const pendingRegistration = await prisma.registration.create({
    data: {
      status: RegistrationStatus.PENDING,
      userId: participantUser2.id,
      jobId: rangerJob.id
    }
  });

  console.log(`Created pending registration for user ${participantUser2.firstName} ${participantUser2.lastName} for ${rangerJob.name} job`);

  // Create a notification
  const notification = await prisma.notification.create({
    data: {
      type: NotificationType.REGISTRATION_CONFIRMATION,
      content: 'Your registration for Kitchen Helper on Aug 26, 2025 has been confirmed.',
      recipient: participantUser1.email,
      status: NotificationStatus.SENT
    }
  });

  console.log(`Created ${await prisma.notification.count()} notification`);

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