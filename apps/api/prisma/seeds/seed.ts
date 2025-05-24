/* eslint-disable @typescript-eslint/no-unused-vars */
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
  
  if (await tableExists('registration_jobs')) {
    await prisma.registrationJob.deleteMany({});
    console.log('Cleaned registration_jobs table');
  }
  
  if (await tableExists('registrations')) {
    await prisma.registration.deleteMany({});
    console.log('Cleaned registrations table');
  }
  
  if (await tableExists('jobs')) {
    await prisma.job.deleteMany({});
    console.log('Cleaned jobs table');
  }
  
  if (await tableExists('shifts')) {
    await prisma.shift.deleteMany({});
    console.log('Cleaned shifts table');
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
  
  if (await tableExists('core_config')) {
    await prisma.coreConfig.deleteMany({});
    console.log('Cleaned core_config table');
  }
  
  console.log('Successfully completed data cleanup');

  // Create users
  console.log(`Created ${await prisma.user.count()} users`);

  // Camp entity has been removed
  console.log('Camp entity has been removed from the schema');

  // Create job categories
  const dayBossCategory = await prisma.jobCategory.create({
    data: {
      name: 'Day Boss',
      description: 'Oversee DZ operations.',
      staffOnly: false
    }
  });

  const artCarCategory = await prisma.jobCategory.create({
    data: {
      name: 'Art Car',
      description: 'Driving the "Skyvan" art car between the Burning Sky camp and the airport to ferry skydivers to and fireflies to and from the airport.',
      staffOnly: false
    }
  });

  const fireflyGreeterCategory = await prisma.jobCategory.create({
    data: {
      name: 'Firefly Greeter',
      description: 'Working at the airport to brief, gear, load, and unload fireflies. Keep the plane turning!',
      staffOnly: false
    }
  });

  const landingAreaCategory = await prisma.jobCategory.create({
    data: {
      name: 'Landing Area',
      description: 'This person is stationed at the windsock to observe landings and provide radio support',
      staffOnly: false
    }
  });

  const manifestAssistantCategory = await prisma.jobCategory.create({
    data: {
      name: 'Manifest Assistant',
      description: 'Working at manifest checking in jumpers and fireflies, and keeping the loads turning.',
      staffOnly: false
    }
  });

  const manifestManagerCategory = await prisma.jobCategory.create({
    data: {
      name: 'Manifest Manager',
      description: 'You know what to do.',
      staffOnly: true
    }
  });

  const teardownCategory = await prisma.jobCategory.create({
    data: {
      name: 'Teardown',
      description: 'Help with taking down airport/camp, mooping, leaving no trace.',
      staffOnly: false
    }
  });

  const airportManagerCategory = await prisma.jobCategory.create({
    data: {
      name: 'Airport Manager',
      description: 'Manage the Greeters and keep the plane turning. Keep Manifest aware of what\'s up.',
      staffOnly: true
    }
  });

  console.log(`Created ${await prisma.jobCategory.count()} job categories`);

  // Create shifts
  console.log('Creating shifts...');

  // Wednesday shifts
  const wednesdayAM = await prisma.shift.create({
    data: {
      name: 'Wednesday AM',
      description: 'Wednesday morning shift',
      startTime: '09:30',
      endTime: '14:30',
      dayOfWeek: 'WEDNESDAY',
    },
  });

  const wednesdayPM = await prisma.shift.create({
    data: {
      name: 'Wednesday PM',
      description: 'Wednesday afternoon/evening shift',
      startTime: '14:00',
      endTime: '19:00',
      dayOfWeek: 'WEDNESDAY',
    },
  });

  // Thursday shifts
  const thursdayAM = await prisma.shift.create({
    data: {
      name: 'Thursday AM',
      description: 'Thursday morning shift',
      startTime: '09:30',
      endTime: '14:30',
      dayOfWeek: 'THURSDAY',
    },
  });

  const thursdayPM = await prisma.shift.create({
    data: {
      name: 'Thursday PM',
      description: 'Thursday afternoon/evening shift',
      startTime: '14:00',
      endTime: '19:00',
      dayOfWeek: 'THURSDAY',
    },
  });

  // Friday shifts
  const fridayAM = await prisma.shift.create({
    data: {
      name: 'Friday AM',
      description: 'Friday morning shift',
      startTime: '09:30',
      endTime: '14:30',
      dayOfWeek: 'FRIDAY',
    },
  });

  const fridayPM = await prisma.shift.create({
    data: {
      name: 'Friday PM',
      description: 'Friday afternoon/evening shift',
      startTime: '14:00',
      endTime: '19:00',
      dayOfWeek: 'FRIDAY',
    },
  });

  // Saturday shifts
  const saturdayAM = await prisma.shift.create({
    data: {
      name: 'Saturday AM',
      description: 'Saturday morning shift',
      startTime: '09:30',
      endTime: '14:30',
      dayOfWeek: 'SATURDAY',
    },
  });

  const saturdayPM = await prisma.shift.create({
    data: {
      name: 'Saturday PM',
      description: 'Saturday afternoon/evening shift',
      startTime: '14:00',
      endTime: '19:00',
      dayOfWeek: 'SATURDAY',
    },
  });

  // Closing Sunday shifts
  const closingSunday1 = await prisma.shift.create({
    data: {
      name: 'Closing Sunday 1',
      description: 'First closing Sunday shift',
      startTime: '10:00',
      endTime: '13:00',
      dayOfWeek: 'CLOSING_SUNDAY',
    },
  });

  const closingSunday2 = await prisma.shift.create({
    data: {
      name: 'Closing Sunday 2',
      description: 'Second closing Sunday shift',
      startTime: '15:00',
      endTime: '18:00',
      dayOfWeek: 'CLOSING_SUNDAY',
    },
  });

  // Pre-opening shift (keep one for setup)
  const preOpeningShift = await prisma.shift.create({
    data: {
      name: 'Pre-Opening Setup',
      description: 'Early camp setup',
      startTime: '10:00',
      endTime: '16:00',
      dayOfWeek: 'PRE_OPENING',
    },
  });
  
  console.log(`Created ${await prisma.shift.count()} shifts`);

  // Create jobs (after shifts)
  
  // Teardown jobs - Closing Sunday shifts
  await prisma.job.create({
    data: {
      name: 'Teardown Team 1',
      description: 'Help break down airport/camp, mooping, leaving no trace',
      categoryId: teardownCategory.id,
      location: 'Entire Camp',
      shiftId: closingSunday1.id,
      maxRegistrations: 6
    }
  });

  await prisma.job.create({
    data: {
      name: 'Teardown Team 2',
      description: 'Help break down airport/camp, mooping, leaving no trace',
      categoryId: teardownCategory.id,
      location: 'Entire Camp',
      shiftId: closingSunday2.id,
      maxRegistrations: 6
    }
  });

  // Art Car Driver jobs - AM/PM shifts for Wed-Sat
  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Wednesday AM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: wednesdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Wednesday PM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: wednesdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Thursday AM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: thursdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Thursday PM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: thursdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Friday AM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: fridayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Friday PM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: fridayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Saturday AM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: saturdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Saturday PM',
      description: 'Drive the Skyvan art car to ferry skydivers and fireflies',
      categoryId: artCarCategory.id,
      location: 'Between Camp and Airport',
      shiftId: saturdayPM.id,
      maxRegistrations: 2
    }
  });

  // Manifest Assistant jobs - AM/PM shifts for Wed-Sat
  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Wednesday AM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: wednesdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Wednesday PM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: wednesdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Thursday AM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: thursdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Thursday PM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: thursdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Friday AM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: fridayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Friday PM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: fridayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Saturday AM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: saturdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Saturday PM',
      description: 'Check in jumpers and fireflies, keep loads turning',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: saturdayPM.id,
      maxRegistrations: 2
    }
  });

  // Firefly Greeter jobs - AM/PM shifts for Wed-Sat
  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Wednesday AM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: wednesdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Wednesday PM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: wednesdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Thursday AM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: thursdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Thursday PM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: thursdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Friday AM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: fridayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Friday PM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: fridayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Saturday AM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: saturdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Saturday PM',
      description: 'Brief, gear, load, and unload fireflies at the airport',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: saturdayPM.id,
      maxRegistrations: 3
    }
  });

  // Landing Area jobs - AM/PM shifts for Wed-Sat
  await prisma.job.create({
    data: {
      name: 'Landing Area - Wednesday AM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: wednesdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Wednesday PM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: wednesdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Thursday AM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: thursdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Thursday PM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: thursdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Friday AM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: fridayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Friday PM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: fridayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Saturday AM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: saturdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area - Saturday PM',
      description: 'Station at windsock to observe landings and provide radio support',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: saturdayPM.id,
      maxRegistrations: 1
    }
  });

  console.log(`Created ${await prisma.job.count()} jobs`);

  // Create core configuration
  console.log('Creating core configuration...');
  await prisma.coreConfig.create({
    data: {
      campName: 'Playa Plan',
      campDescription: 'A Burning Man camp planning tool.',
      homePageBlurb: 'Please log in and configure your camp settings.',
      registrationYear: 2025,
      earlyRegistrationOpen: false,
      registrationOpen: true,
      registrationTerms: 'By registering, you agree to follow our camp principles and contribute to our community.',
      allowDeferredDuesPayment: false,
      stripeEnabled: false,
      paypalEnabled: false,
      smtpHost: 'localhost',
      smtpPort: 587,
      smtpSecure: false,
      senderEmail: 'camp@example.playaplan.app',
      senderName: 'Playa Plan',
      timeZone: 'America/Los_Angeles',
    },
  });

  console.log('Created core configuration');

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