import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('shifts')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiCreatedResponse({ description: 'The shift has been successfully created.' })
  async create(@Body() createShiftDto: CreateShiftDto) {
    return this.shiftsService.create(createShiftDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiOkResponse({ description: 'Returns all shifts.' })
  async findAll() {
    return this.shiftsService.findAll();
  }
  
  @Get('with-jobs-and-registrations')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get all shifts with jobs and registrations' })
  @ApiOkResponse({ description: 'Returns all shifts with jobs and user registrations.' })
  async findAllWithJobsAndRegistrations() {
    // Get all shifts with their associated jobs and job registrations
    const shifts = await this.prisma.shift.findMany({
      include: {
        jobs: {
          include: {
            category: true,
            registrations: {
              include: {
                registration: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        playaName: true,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });

    // Transform the data to match the expected format in the frontend
    return {
      shifts: shifts.map(shift => ({
        id: shift.id,
        name: shift.name,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        jobs: shift.jobs.map(job => ({
          id: job.id,
          name: job.name,
          location: job.location,
          maxRegistrations: job.maxRegistrations,
          categoryId: job.categoryId,
          category: {
            id: job.category.id,
            name: job.category.name
          },
          registrations: job.registrations.map(regJob => ({
            id: regJob.id,
            user: {
              id: regJob.registration.user.id,
              firstName: regJob.registration.user.firstName,
              lastName: regJob.registration.user.lastName,
              playaName: regJob.registration.user.playaName
            }
          }))
        }))
      }))
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by id' })
  @ApiOkResponse({ description: 'Returns the shift with the specified id.' })
  async findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Update a shift' })
  @ApiOkResponse({ description: 'The shift has been successfully updated.' })
  async update(@Param('id') id: string, @Body() updateShiftDto: UpdateShiftDto) {
    return this.shiftsService.update(id, updateShiftDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a shift' })
  @ApiOkResponse({ description: 'The shift has been successfully deleted.' })
  async remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }
}