import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import {
  ApplicationQueryDto,
  ApproveApplicationDto,
  BulkApplicationActionDto,
  DeclineApplicationDto,
} from '../dto/application-admin.dto';
import { ApplicationAdminService } from '../services/application-admin.service';

@ApiTags('Application Management')
@ApiBearerAuth()
@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class ApplicationAdminController {
  constructor(private readonly applicationAdminService: ApplicationAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List registration applications' })
  async listApplications(@Query() query: ApplicationQueryDto) {
    return this.applicationAdminService.listApplications(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application detail' })
  async getApplicationDetail(@Param('id') id: string) {
    return this.applicationAdminService.getApplicationDetail(id);
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk approve/decline applications' })
  async bulkProcessApplications(
    @Body() dto: BulkApplicationActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.applicationAdminService.bulkProcessApplications(req.user.id, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve an application' })
  async approveApplication(
    @Param('id') id: string,
    @Body() dto: ApproveApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.applicationAdminService.approveApplication(id, req.user.id, dto);
  }

  @Patch(':id/decline')
  @ApiOperation({ summary: 'Decline an application' })
  async declineApplication(
    @Param('id') id: string,
    @Body() dto: DeclineApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.applicationAdminService.declineApplication(id, req.user.id, dto);
  }
}
