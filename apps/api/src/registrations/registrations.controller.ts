import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto, UpdateRegistrationDto } from './dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('registrations')
@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new registration' })
  @ApiCreatedResponse({ description: 'The registration has been successfully created.' })
  async create(@Body() createRegistrationDto: CreateRegistrationDto) {
    return this.registrationsService.create(createRegistrationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all registrations with optional filtering' })
  @ApiOkResponse({ description: 'Returns registrations based on filters.' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'shiftId', required: false, description: 'Filter by shift ID' })
  async findAll(@Query('userId') userId?: string, @Query('shiftId') shiftId?: string) {
    if (userId) {
      return this.registrationsService.findByUser(userId);
    } else if (shiftId) {
      return this.registrationsService.findByShift(shiftId);
    } else {
      return this.registrationsService.findAll();
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

  @Get('test/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin test endpoint for smoke testing' })
  @ApiOkResponse({ description: 'Returns a test message if authentication works.' })
  async adminTest() {
    return { message: 'Admin access to registrations module confirmed' };
  }
}
