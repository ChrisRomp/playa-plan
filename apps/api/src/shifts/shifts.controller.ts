import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
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

@ApiTags('shifts')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly registrationsService: RegistrationsService,
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

  @Post(':id/register')
  @ApiOperation({ summary: 'Register current user for a shift' })
  @ApiCreatedResponse({ description: 'User has been successfully registered for the shift.' })
  async register(@Param('id') shiftId: string, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    
    return this.registrationsService.create({
      userId,
      shiftId,
    });
  }

  @Get('/registrations/me')
  @ApiOperation({ summary: 'Get all shift registrations for the current user' })
  @ApiOkResponse({ description: 'Returns all shift registrations for the current user.' })
  async getMyRegistrations(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.registrationsService.findByUser(userId);
  }

  @Get('/registrations/:id')
  @ApiOperation({ summary: 'Get a specific shift registration' })
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
  @ApiOperation({ summary: 'Cancel a shift registration' })
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
  @ApiOperation({ summary: 'Get all registrations for a specific shift (admin only)' })
  @ApiOkResponse({ description: 'Returns all registrations for the specified shift.' })
  async getShiftRegistrations(@Param('id') shiftId: string) {
    return this.registrationsService.findByShift(shiftId);
  }
} 