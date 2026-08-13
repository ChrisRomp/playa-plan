import { Injectable } from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { TicketReceiptReportData } from '../models/ticket-receipt-report-data';

/** Selects and formats confirmed attendees for ticket-receipt reports. */
@Injectable()
export class TicketReceiptDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coreConfigService: CoreConfigService
  ) {}

  async getReportData(options: GenerateTicketReceiptReportDto): Promise<TicketReceiptReportData> {
    const year = await this.resolveYear(options.year);
    const where = this.buildRegistrationFilter(year, options.campingOptionId);
    const registrations = await this.prisma.registration.findMany({
      where,
      select: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        jobs: {
          select: {
            job: {
              select: {
                name: true,
                shift: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    return {
      year,
      attendees: registrations.map(registration => ({
        name: `${registration.user.firstName} ${registration.user.lastName}`,
        workShifts: registration.jobs
          .map(({ job }) => `${job.name} (${job.shift.name})`)
          .sort((left, right) => left.localeCompare(right))
          .join('; '),
      })),
    };
  }

  private async resolveYear(requestedYear?: number): Promise<number> {
    if (requestedYear != null) {
      return requestedYear;
    }

    const configuration = await this.coreConfigService.findCurrent();
    return configuration.registrationYear;
  }

  private buildRegistrationFilter(
    year: number,
    campingOptionId?: string
  ): Prisma.RegistrationWhereInput {
    const where: Prisma.RegistrationWhereInput = {
      status: RegistrationStatus.CONFIRMED,
      year,
    };

    if (campingOptionId) {
      where.campingOptionRegistrations = {
        some: { campingOptionId },
      };
    }

    return where;
  }
}
