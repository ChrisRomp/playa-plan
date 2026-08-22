import { Injectable } from '@nestjs/common';
import { RegistrationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { RegistrationJobSelectionService } from '../../registrations/services/registration-job-selection.service';
import { ScheduleExceptionsReportData } from '../models/schedule-exceptions-report-data';

/** Builds the current-year confirmed registration schedule-exceptions report. */
@Injectable()
export class ScheduleExceptionsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coreConfigService: CoreConfigService,
    private readonly jobSelectionService: RegistrationJobSelectionService,
  ) {}

  /** Return confirmed registrations whose work schedules contain exceptions. */
  async getReportData(): Promise<ScheduleExceptionsReportData> {
    const configuration = await this.coreConfigService.findCurrent();
    const year = configuration.registrationYear;
    const [alwaysRequiredCategories, registrations] = await Promise.all([
      this.prisma.jobCategory.findMany({
        where: { alwaysRequired: true },
        select: { id: true, staffOnly: true },
      }),
      this.prisma.registration.findMany({
        where: {
          status: RegistrationStatus.CONFIRMED,
          year,
        },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              playaName: true,
              email: true,
              role: true,
              allowNoJob: true,
            },
          },
          campingOptionRegistrations: {
            select: {
              campingOption: {
                select: {
                  workShiftsRequired: true,
                },
              },
            },
          },
          jobs: {
            select: {
              job: {
                select: {
                  id: true,
                  name: true,
                  category: {
                    select: { name: true },
                  },
                  shift: {
                    select: {
                      id: true,
                      name: true,
                      dayOfWeek: true,
                      startTime: true,
                      endTime: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
    ]);

    const exceptions: ScheduleExceptionsReportData['exceptions'] =
      registrations.flatMap(registration => {
        const jobs = registration.jobs.map(({ job }) => ({
          ...job,
          shift: {
            ...job.shift,
            dayOfWeek: job.shift.dayOfWeek.toString(),
          },
        }));
        const roleVisibleCategories = alwaysRequiredCategories.filter(
          category =>
            registration.user.role !== UserRole.PARTICIPANT ||
            !category.staffOnly,
        );
        const analysis = this.jobSelectionService.analyze({
          jobs,
          allowNoJob: registration.user.allowNoJob,
          campingOptions: registration.campingOptionRegistrations.map(
            ({ campingOption }) => campingOption,
          ),
          alwaysRequiredCategories: roleVisibleCategories,
        });
        if (analysis.extraCount === 0 && analysis.conflicts.length === 0) {
          return [];
        }

        return [
          {
            registrationId: registration.id,
            user: {
              ...registration.user,
              role: registration.user.role.toString(),
            },
            requiredCount: analysis.requiredCount,
            selectedCount: analysis.selectedCount,
            extraCount: analysis.extraCount,
            jobs: jobs.map(({ category, ...job }) => ({
              ...job,
              categoryName: category.name,
            })),
            conflicts: analysis.conflicts.map(({ firstJob, secondJob }) => ({
              firstJob: {
                id: firstJob.id,
                name: firstJob.name,
                shift: firstJob.shift,
              },
              secondJob: {
                id: secondJob.id,
                name: secondJob.name,
                shift: secondJob.shift,
              },
            })),
          },
        ];
      });

    return { year, exceptions };
  }
}
