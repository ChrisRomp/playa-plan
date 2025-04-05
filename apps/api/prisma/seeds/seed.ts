import { PrismaClient, UserRole, SignupStatus, PaymentStatus, PaymentProvider, NotificationType, NotificationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('Starting database seed...');

  // Clean up existing data (in reverse order to respect foreign key constraints)
  await prisma.notification.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.signup.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.jobCategory.deleteMany({});
  await prisma.camp.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('Cleaned up existing data');

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

  // Create a camp
  const camp = await prisma.camp.create({
    data: {
      name: 'Burning Sky 2025',
      description: 'Burning Sky at Burning Man 2025',
      startDate: new Date('2025-08-25T00:00:00Z'),
      endDate: new Date('2025-09-01T23:59:59Z'),
      location: 'Black Rock Desert, NV',
      capacity: 200,
      isActive: true
    }
  });

  console.log(`Created camp: ${camp.name}`);

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

  // Create jobs
  const kitchenJob = await prisma.job.create({
    data: {
      name: 'Kitchen Helper',
      description: 'Assist with meal preparation and cleanup',
      categoryId: kitchenCategory.id,
      location: 'Main Camp Kitchen'
    }
  });

  const greeterJob = await prisma.job.create({
    data: {
      name: 'Camp Greeter',
      description: 'Welcome new arrivals and help with orientation',
      categoryId: greeterCategory.id,
      location: 'Main Entrance'
    }
  });

  const rangerJob = await prisma.job.create({
    data: {
      name: 'Night Ranger',
      description: 'Patrol the camp during night hours',
      categoryId: rangerCategory.id,
      location: 'All Camp Areas'
    }
  });

  console.log(`Created ${await prisma.job.count()} jobs`);

  // Create shifts
  const morningKitchenShift = await prisma.shift.create({
    data: {
      startTime: new Date('2025-08-26T08:00:00Z'),
      endTime: new Date('2025-08-26T12:00:00Z'),
      maxSignups: 5,
      campId: camp.id,
      jobId: kitchenJob.id
    }
  });

  const afternoonKitchenShift = await prisma.shift.create({
    data: {
      startTime: new Date('2025-08-26T13:00:00Z'),
      endTime: new Date('2025-08-26T17:00:00Z'),
      maxSignups: 5,
      campId: camp.id,
      jobId: kitchenJob.id
    }
  });

  const morningGreeterShift = await prisma.shift.create({
    data: {
      startTime: new Date('2025-08-26T09:00:00Z'),
      endTime: new Date('2025-08-26T13:00:00Z'),
      maxSignups: 3,
      campId: camp.id,
      jobId: greeterJob.id
    }
  });

  const nightRangerShift = await prisma.shift.create({
    data: {
      startTime: new Date('2025-08-26T22:00:00Z'),
      endTime: new Date('2025-08-27T02:00:00Z'),
      maxSignups: 4,
      campId: camp.id,
      jobId: rangerJob.id
    }
  });

  console.log(`Created ${await prisma.shift.count()} shifts`);

  // Create a signup with payment
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

  const signup = await prisma.signup.create({
    data: {
      status: SignupStatus.CONFIRMED,
      userId: participantUser1.id,
      shiftId: morningKitchenShift.id,
      paymentId: payment.id
    }
  });

  console.log(`Created signup for user ${participantUser1.firstName} ${participantUser1.lastName} for ${kitchenJob.name} shift`);
  
  // Create another signup without payment
  const pendingSignup = await prisma.signup.create({
    data: {
      status: SignupStatus.PENDING,
      userId: participantUser2.id,
      shiftId: nightRangerShift.id
    }
  });

  console.log(`Created pending signup for user ${participantUser2.firstName} ${participantUser2.lastName} for ${rangerJob.name} shift`);

  // Create a notification
  const notification = await prisma.notification.create({
    data: {
      type: NotificationType.SIGNUP_CONFIRMATION,
      content: 'Your signup for Kitchen Helper on Aug 26, 2025 has been confirmed.',
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