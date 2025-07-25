import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RegistrationAdminService } from '../services/registration-admin.service';
import {
  AdminEditRegistrationDto,
  AdminCancelRegistrationDto,
  AdminRegistrationResponseDto,
  AdminRegistrationQueryDto,
} from '../dto/admin-registration.dto';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Admin Registration Management')
@ApiBearerAuth()
@Controller('admin/registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminRegistrationsController {
  constructor(private readonly adminService: RegistrationAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all registrations for admin management',
    description: 'Retrieve paginated list of registrations with filtering capabilities for admin management interface',
  })
  @ApiQuery({
    name: 'userId',
    description: 'Filter by user ID',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'year',
    description: 'Filter by registration year',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by registration status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED'],
  })
  @ApiQuery({
    name: 'email',
    description: 'Search by user email (partial match)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'name',
    description: 'Search by user name (partial match)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of records per page',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved registrations',
    schema: {
      type: 'object',
      properties: {
        registrations: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getRegistrations(@Query() query: AdminRegistrationQueryDto) {
    return this.adminService.getRegistrations(query);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Edit a registration',
    description: 'Update registration details including status, work shifts, and camping options with audit trail logging',
  })
  @ApiParam({
    name: 'id',
    description: 'Registration ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Registration successfully updated',
    type: AdminRegistrationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data or cannot edit cancelled registration' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Not Found - Registration not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Resource capacity exceeded' })
  async editRegistration(
    @Param('id') registrationId: string,
    @Body() editData: AdminEditRegistrationDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<AdminRegistrationResponseDto> {
    const adminUserId = req.user.id;
    return this.adminService.editRegistration(registrationId, editData, adminUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a registration',
    description: 'Cancel registration, clean up related records, and handle refund prompting with audit trail logging',
  })
  @ApiParam({
    name: 'id',
    description: 'Registration ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Registration successfully cancelled',
    type: AdminRegistrationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Registration already cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Not Found - Registration not found' })
  async cancelRegistration(
    @Param('id') registrationId: string,
    @Body() cancelData: AdminCancelRegistrationDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<AdminRegistrationResponseDto> {
    const adminUserId = req.user.id;
    return this.adminService.cancelRegistration(registrationId, cancelData, adminUserId);
  }

  @Get(':id/audit-trail')
  @ApiOperation({
    summary: 'Get audit trail for a registration',
    description: 'Retrieve complete audit trail showing all administrative actions performed on this registration',
  })
  @ApiParam({
    name: 'id',
    description: 'Registration ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Audit trail successfully retrieved',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          adminUserId: { type: 'string' },
          actionType: { type: 'string' },
          targetRecordType: { type: 'string' },
          targetRecordId: { type: 'string' },
          oldValues: { type: 'object' },
          newValues: { type: 'object' },
          reason: { type: 'string' },
          transactionId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          adminUser: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Not Found - Registration not found' })
  async getRegistrationAuditTrail(@Param('id') registrationId: string) {
    return this.adminService.getRegistrationAuditTrail(registrationId);
  }

  @Get(':id/camping-options')
  @ApiOperation({
    summary: 'Get camping options for a registration user',
    description: 'Retrieve all camping options registered by the user of this registration',
  })
  @ApiParam({
    name: 'id',
    description: 'Registration ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Camping options successfully retrieved',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          campingOptionId: { type: 'string' },
          campingOption: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              participantDues: { type: 'number' },
              staffDues: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Not Found - Registration not found' })
  async getUserCampingOptions(@Param('id') registrationId: string) {
    return this.adminService.getUserCampingOptions(registrationId);
  }
} 