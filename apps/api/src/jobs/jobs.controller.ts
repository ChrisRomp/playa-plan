import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { RegistrationsService } from '../registrations/registrations.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    roles?: UserRole[];
    role?: UserRole;
    // Add other properties if needed
  };
}

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly registrationsService: RegistrationsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new job' })
  @ApiCreatedResponse({ description: 'The job has been successfully created.' })
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all jobs' })
  @ApiOkResponse({ description: 'Returns all jobs.' })
  findAll() {
    return this.jobsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job by id' })
  @ApiOkResponse({ description: 'Returns the job with the specified id.' })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a job' })
  @ApiOkResponse({ description: 'The job has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a job' })
  @ApiOkResponse({ description: 'The job has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }

  @Post(':id/register')
  @ApiOperation({ summary: 'Register current user for a job' })
  @ApiCreatedResponse({ description: 'User has been successfully registered for the job.' })
  async register(@Param('id') jobId: string, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    const currentYear = new Date().getFullYear(); // You might want to get this from config instead
    
    return this.registrationsService.create({
      userId,
      year: currentYear,
      jobIds: [jobId],
    });
  }

  @Get('/registrations/me')
  @ApiOperation({ summary: 'Get all job registrations for the current user' })
  @ApiOkResponse({ description: 'Returns all job registrations for the current user.' })
  async getMyRegistrations(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.registrationsService.findByUser(userId);
  }

  @Get('/registrations/:id')
  @ApiOperation({ summary: 'Get a specific job registration' })
  @ApiOkResponse({ description: 'Returns the requested registration if it belongs to the current user or user is admin.' })
  async getRegistration(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Get the registration
    const registration = await this.registrationsService.findOne(id);
    
    // Check if the registration belongs to the current user or if the user is an admin
    const isAdmin = req.user.roles?.includes(UserRole.ADMIN) || req.user.role === UserRole.ADMIN;
    if (registration.userId !== req.user.id && !isAdmin) {
      throw new ForbiddenException('You do not have permission to access this registration.');
    }
    
    return registration;
  }

  @Delete('/registrations/:id')
  @ApiOperation({ summary: 'Cancel a job registration' })
  @ApiOkResponse({ description: 'The registration has been successfully cancelled.' })
  async cancelRegistration(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Get the registration
    const registration = await this.registrationsService.findOne(id);
    
    // Check if the registration belongs to the current user or if the user is an admin
    const isAdmin = req.user.roles?.includes(UserRole.ADMIN) || req.user.role === UserRole.ADMIN;
    if (registration.userId !== req.user.id && !isAdmin) {
      throw new ForbiddenException('You do not have permission to cancel this registration.');
    }
    
    // Update the registration status to CANCELLED
    return this.registrationsService.update(id, { status: 'CANCELLED' });
  }

  @Get(':id/registrations')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get all registrations for a specific job (admin/staff only)' })
  @ApiOkResponse({ description: 'Returns all registrations for the specified job.' })
  async getJobRegistrations(@Param('id') jobId: string) {
    return this.registrationsService.findByJob(jobId);
  }
} 