import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto, AddJobToRegistrationDto, CreateCampRegistrationDto, UpdateRegistrationDto } from './dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Type definition for authenticated request
 */
interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('registrations')
@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new registration for a user for a specific year' })
  @ApiCreatedResponse({ description: 'The registration has been successfully created.' })
  async create(@Body() createRegistrationDto: CreateRegistrationDto) {
    return this.registrationsService.create(createRegistrationDto);
  }

  @Post(':id/jobs')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Add a job to an existing registration' })
  @ApiCreatedResponse({ description: 'The job has been successfully added to the registration.' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  async addJobToRegistration(
    @Param('id') id: string,
    @Body() addJobDto: AddJobToRegistrationDto
  ) {
    return this.registrationsService.addJobToRegistration(id, addJobDto);
  }

  @Delete(':id/jobs/:jobId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Remove a job from a registration' })
  @ApiOkResponse({ description: 'The job has been successfully removed from the registration.' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID to remove' })
  async removeJobFromRegistration(
    @Param('id') id: string,
    @Param('jobId') jobId: string
  ) {
    return this.registrationsService.removeJobFromRegistration(id, jobId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all registrations with optional filtering' })
  @ApiOkResponse({ description: 'Returns registrations based on filters.' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'jobId', required: false, description: 'Filter by job ID' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year (use with userId)' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('jobId') jobId?: string,
    @Query('year') year?: string
  ) {
    if (userId && year) {
      return this.registrationsService.findByUserAndYear(userId, parseInt(year));
    } else if (userId) {
      return this.registrationsService.findByUser(userId);
    } else if (jobId) {
      return this.registrationsService.findByJob(jobId);
    } else {
      return this.registrationsService.findAll();
    }
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my registrations' })
  @ApiOkResponse({ description: 'Returns all registrations for the authenticated user.' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by specific year' })
  async getMyRegistrations(@Request() req: AuthRequest, @Query('year') year?: string) {
    if (year) {
      return this.registrationsService.findByUserAndYear(req.user.id, parseInt(year));
    } else {
      return this.registrationsService.findByUser(req.user.id);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a registration by id' })
  @ApiOkResponse({ description: 'Returns the registration with the specified id.' })
  async findOne(@Param('id') id: string) {
    return this.registrationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Update a registration' })
  @ApiOkResponse({ description: 'The registration has been successfully updated.' })
  async update(@Param('id') id: string, @Body() updateRegistrationDto: UpdateRegistrationDto) {
    return this.registrationsService.update(id, updateRegistrationDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a registration' })
  @ApiOkResponse({ description: 'The registration has been successfully deleted.' })
  async remove(@Param('id') id: string) {
    return this.registrationsService.remove(id);
  }

  @Post('camp')
  @ApiOperation({ summary: 'Create a comprehensive camp registration' })
  @ApiCreatedResponse({ description: 'The camp registration has been successfully created.' })
  async createCampRegistration(
    @Body() createCampRegistrationDto: CreateCampRegistrationDto,
    @Request() req: AuthRequest
  ) {
    return this.registrationsService.createCampRegistration(req.user.id, createCampRegistrationDto);
  }

  @Get('camp/me')
  @ApiOperation({ summary: 'Get my complete camp registration' })
  @ApiOkResponse({ description: 'Returns the user\'s complete camp registration including camping options and custom fields.' })
  async getMyCampRegistration(@Request() req: AuthRequest) {
    return this.registrationsService.getMyCampRegistration(req.user.id);
  }

  @Get('test/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin test endpoint for smoke testing' })
  @ApiOkResponse({ description: 'Returns a test message if authentication works.' })
  async adminTest() {
    return { message: 'Admin access to registrations module confirmed' };
  }
}
