import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Check for force re-seed flag from environment or command line args
const FORCE_RESEED = process.env.FORCE_RESEED === 'true' || 
                     process.argv.includes('--force') || 
                     process.argv.includes('-f');

async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Try to get a count from the table - if it doesn't exist, it will throw an error
    await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${tableName}"`);
    return true;
  } catch {
    return false;
  }
}

async function isAlreadySeeded(): Promise<boolean> {
  try {
    // Check if core_config has any data - if it does, assume database is seeded
    const coreConfigCount = await prisma.coreConfig.count();
    return coreConfigCount > 0;
  } catch {
    return false;
  }
}

async function cleanupExistingData() {
  console.log('Cleaning up existing data...');
  
  // Clean up existing data (in reverse order to respect foreign key constraints)
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
  
  if (await tableExists('camping_option_field_values')) {
    await prisma.campingOptionFieldValue.deleteMany({});
    console.log('Cleaned camping_option_field_values table');
  }
  
  if (await tableExists('camping_option_registrations')) {
    await prisma.campingOptionRegistration.deleteMany({});
    console.log('Cleaned camping_option_registrations table');
  }
  
  if (await tableExists('camping_option_fields')) {
    await prisma.campingOptionField.deleteMany({});
    console.log('Cleaned camping_option_fields table');
  }
  
  if (await tableExists('camping_option_job_categories')) {
    await prisma.campingOptionJobCategory.deleteMany({});
    console.log('Cleaned camping_option_job_categories table');
  }
  
  if (await tableExists('camping_options')) {
    await prisma.campingOption.deleteMany({});
    console.log('Cleaned camping_options table');
  }
  
  if (await tableExists('users')) {
    await prisma.user.deleteMany({});
    console.log('Cleaned users table');
  }
  
  if (await tableExists('core_config')) {
    await prisma.coreConfig.deleteMany({});
    console.log('Cleaned core_config table');
  }
  
  console.log('Successfully completed data cleanup');
}

async function main() {
  console.log('Starting database seed...');
  
  // Check if we should seed
  const alreadySeeded = await isAlreadySeeded();
  
  if (alreadySeeded && !FORCE_RESEED) {
    console.log('Database appears to already be seeded. Skipping seed.');
    console.log('To force re-seeding, use one of:');
    console.log('  - FORCE_RESEED=true npm run seed:dev');
    console.log('  - npm run seed:dev -- --force');
    console.log('  - npm run seed:dev -- -f');
    return;
  }
  
  if (FORCE_RESEED) {
    console.log('Force re-seed flag detected. Cleaning existing data...');
    await cleanupExistingData();
  } else {
    console.log('Database appears empty. Proceeding with initial seed...');
  }

  // Create users
  console.log(`Created ${await prisma.user.count()} users`);

  // Camp entity has been removed
  console.log('Camp entity has been removed from the schema');

  // Create job categories
  const dayBossCategory = await prisma.jobCategory.create({
    data: {
      name: 'Day Boss',
      description: 'Keep the DZ running. Move around and make sure it is.',
      staffOnly: true
    }
  });

  const artCarDriverCategory = await prisma.jobCategory.create({
    data: {
      name: 'Art Car Driver',
      description: 'Driving the art car between the Burning Sky camp and the airport to ferry skydivers and fireflies to and from the airport.',
      staffOnly: false
    }
  });

  const artCarCaptainCategory = await prisma.jobCategory.create({
    data: {
      name: 'Art Car Captain',
      description: 'Responsible for the care and feeding of our beloved Betsy Gossamer Deathtrap',
      staffOnly: true
    }
  });

  const artCarMaintenanceCategory = await prisma.jobCategory.create({
    data: {
      name: 'Art Car Maintenance',
      description: 'Day to day maintenance of the Art Car. If it does not run, make it run.',
      staffOnly: true
    }
  });

  const dzManagerCategory = await prisma.jobCategory.create({
    data: {
      name: 'DZ Manager',
      description: 'Bitch on call.',
      staffOnly: true
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
      name: 'Landing Area Radio Station',
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
      staffOnly: false,
      alwaysRequired: true
    }
  });

  const airportManagerCategory = await prisma.jobCategory.create({
    data: {
      name: 'Airport Manager',
      description: 'Keep the plane turning. Take care of pilots needs. Manage the Greeters. Keep Manifest aware of what\'s up.',
      staffOnly: true
    }
  });

  console.log(`Created ${await prisma.jobCategory.count()} job categories`);

  // Create camping options
  console.log('Creating camping options...');
  
  const skydivingCampingOption = await prisma.campingOption.create({
    data: {
      name: 'Skydiving',
      description: 'Skydiving camp option',
      enabled: true,
      workShiftsRequired: 1,
      participantDues: 600.0,
      staffDues: 600.0,
      maxSignups: 60,
      fields: {
        create: [
          {
            displayName: 'Camping Footprint',
            description: 'Please describe your camping footprint, space, etc. If you\'re not camping at Burning Sky, leave blank.',
            dataType: 'MULTILINE_STRING',
            required: false,
            minLength: 10,
            maxLength: 1024,
            order: 0
          },
          {
            displayName: 'How many skydives have you done in total?',
            dataType: 'INTEGER',
            required: true,
            order: 1
          },
          {
            displayName: 'How many skydives have you done in the last 6 months?',
            dataType: 'INTEGER',
            required: true,
            order: 2
          },
          {
            displayName: 'Please list your license(s) (with numbers) and rating(s)',
            description: 'Optional, but helps us get to know you better. Burning Sky is not a UPSA drop zone.',
            dataType: 'MULTILINE_STRING',
            required: false,
            maxLength: 1024,
            order: 3
          },
          {
            displayName: 'Total Years Jumping with Burning Sky',
            description: 'Including this year',
            dataType: 'INTEGER',
            required: true,
            minValue: 1,
            order: 4
          }
        ]
      }
    }
  });

  console.log(`Created ${await prisma.campingOption.count()} camping options`);

  // Associate job categories with camping options
  console.log('Creating camping option job category associations...');
  
  // Associate all job categories except teardown with the skydiving camping option
  await prisma.campingOptionJobCategory.createMany({
    data: [
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: dayBossCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: artCarDriverCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: artCarCaptainCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: artCarMaintenanceCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: dzManagerCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: fireflyGreeterCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: landingAreaCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: manifestAssistantCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: manifestManagerCategory.id },
      { campingOptionId: skydivingCampingOption.id, jobCategoryId: airportManagerCategory.id }
      // Note: teardownCategory is intentionally excluded
    ]
  });

  console.log(`Created ${await prisma.campingOptionJobCategory.count()} camping option job category associations`);

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

  // Full-day shifts for Wed-Sat (9:00-19:00)
  const wednesdayFull = await prisma.shift.create({
    data: {
      name: 'Wednesday Full',
      description: 'Wednesday full day shift',
      startTime: '09:00',
      endTime: '19:00',
      dayOfWeek: 'WEDNESDAY',
    },
  });

  const thursdayFull = await prisma.shift.create({
    data: {
      name: 'Thursday Full',
      description: 'Thursday full day shift',
      startTime: '09:00',
      endTime: '19:00',
      dayOfWeek: 'THURSDAY',
    },
  });

  const fridayFull = await prisma.shift.create({
    data: {
      name: 'Friday Full',
      description: 'Friday full day shift',
      startTime: '09:00',
      endTime: '19:00',
      dayOfWeek: 'FRIDAY',
    },
  });

  const saturdayFull = await prisma.shift.create({
    data: {
      name: 'Saturday Full',
      description: 'Saturday full day shift',
      startTime: '09:00',
      endTime: '19:00',
      dayOfWeek: 'SATURDAY',
    },
  });
  
  console.log(`Created ${await prisma.shift.count()} shifts`);

  // Create jobs (after shifts)
  
  // Airport Manager jobs - AM/PM shifts Wed-Sat (1 per shift)
  await prisma.job.create({
    data: {
      name: 'Airport Manager - Wednesday AM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: wednesdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Wednesday PM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: wednesdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Thursday AM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: thursdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Thursday PM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: thursdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Friday AM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: fridayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Friday PM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: fridayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Saturday AM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: saturdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Airport Manager - Saturday PM',
      categoryId: airportManagerCategory.id,
      location: 'Airport',
      shiftId: saturdayPM.id,
      maxRegistrations: 1
    }
  });

  // Art Car Driver jobs - AM/PM shifts Wed-Sat (2 per shift)
  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Wednesday AM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: wednesdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Wednesday PM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: wednesdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Thursday AM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: thursdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Thursday PM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: thursdayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Friday AM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: fridayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Friday PM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: fridayPM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Saturday AM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: saturdayAM.id,
      maxRegistrations: 2
    }
  });

  await prisma.job.create({
    data: {
      name: 'Art Car Driver - Saturday PM',
      categoryId: artCarDriverCategory.id,
      location: 'Between Camp and Airport',
      shiftId: saturdayPM.id,
      maxRegistrations: 2
    }
  });

  // Day Boss jobs - Full day shifts Wed-Sat (1 per shift)
  await prisma.job.create({
    data: {
      name: 'Day Boss - Wednesday',
      categoryId: dayBossCategory.id,
      location: 'DZ',
      shiftId: wednesdayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Day Boss - Thursday',
      categoryId: dayBossCategory.id,
      location: 'DZ',
      shiftId: thursdayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Day Boss - Friday',
      categoryId: dayBossCategory.id,
      location: 'DZ',
      shiftId: fridayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Day Boss - Saturday',
      categoryId: dayBossCategory.id,
      location: 'DZ',
      shiftId: saturdayFull.id,
      maxRegistrations: 1
    }
  });

  // Firefly Greeter jobs - AM/PM shifts Wed-Sat (3 per shift)
  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Wednesday AM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: wednesdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Wednesday PM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: wednesdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Thursday AM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: thursdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Thursday PM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: thursdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Friday AM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: fridayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Friday PM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: fridayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Saturday AM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: saturdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Firefly Greeter - Saturday PM',
      categoryId: fireflyGreeterCategory.id,
      location: 'Airport',
      shiftId: saturdayPM.id,
      maxRegistrations: 3
    }
  });

  // Landing Area Radio Station jobs - AM/PM shifts Wed-Sat (1 per shift)
  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Wednesday AM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: wednesdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Wednesday PM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: wednesdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Thursday AM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: thursdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Thursday PM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: thursdayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Friday AM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: fridayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Friday PM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: fridayPM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Saturday AM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: saturdayAM.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Landing Area Radio Station - Saturday PM',
      categoryId: landingAreaCategory.id,
      location: 'Landing Area',
      shiftId: saturdayPM.id,
      maxRegistrations: 1
    }
  });

  // Manifest Assistant jobs - AM/PM shifts Wed-Sat (3 per shift, 4 for Wed AM)
  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Wednesday AM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: wednesdayAM.id,
      maxRegistrations: 4
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Wednesday PM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: wednesdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Thursday AM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: thursdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Thursday PM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: thursdayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Friday AM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: fridayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Friday PM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: fridayPM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Saturday AM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: saturdayAM.id,
      maxRegistrations: 3
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Assistant - Saturday PM',
      categoryId: manifestAssistantCategory.id,
      location: 'Manifest',
      shiftId: saturdayPM.id,
      maxRegistrations: 3
    }
  });

  // Manifest Manager jobs - Full day shifts Wed-Sat (1 per shift)
  await prisma.job.create({
    data: {
      name: 'Manifest Manager - Wednesday',
      categoryId: manifestManagerCategory.id,
      location: 'Manifest',
      shiftId: wednesdayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Manager - Thursday',
      categoryId: manifestManagerCategory.id,
      location: 'Manifest',
      shiftId: thursdayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Manager - Friday',
      categoryId: manifestManagerCategory.id,
      location: 'Manifest',
      shiftId: fridayFull.id,
      maxRegistrations: 1
    }
  });

  await prisma.job.create({
    data: {
      name: 'Manifest Manager - Saturday',
      categoryId: manifestManagerCategory.id,
      location: 'Manifest',
      shiftId: saturdayFull.id,
      maxRegistrations: 1
    }
  });

  // Teardown jobs - Closing Sunday shifts (50 for first shift, 20 for second)
  await prisma.job.create({
    data: {
      name: 'Teardown Morning',
      categoryId: teardownCategory.id,
      location: 'Entire Camp',
      shiftId: closingSunday1.id,
      maxRegistrations: 50
    }
  });

  await prisma.job.create({
    data: {
      name: 'Teardown Afternoon',
      categoryId: teardownCategory.id,
      location: 'Entire Camp',
      shiftId: closingSunday2.id,
      maxRegistrations: 20
    }
  });

  console.log(`Created ${await prisma.job.count()} jobs`);

  // Create core configuration
  console.log('Creating core configuration...');
  
  // Get the current year for registration
  const currentYear = new Date().getFullYear();
  console.log(`Setting registration year to current year: ${currentYear}`);
  
  await prisma.coreConfig.create({
    data: {
      campName: 'Playa Plan',
      campDescription: 'A Burning Man camp planning tool.',
      homePageBlurb: 'Please log in and configure your camp settings.',
      campBannerUrl: '/images/playa-plan-banner.png',
      campBannerAltText: 'Stylized desert scene with abstract tents and sculptures, including a large wooden figure, representing a Burning Man-inspired setting.',
      campIconUrl: '/icons/playa-plan-icon.png',
      campIconAltText: 'Minimalist icon showing a checkmark integrated with a sun over stylized desert dunes, evoking themes of planning and the playa.',
      registrationYear: currentYear,
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