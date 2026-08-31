import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import {
  DeleteUnverifiedUsersDto,
  UnverifiedUserCleanupQueryDto,
} from '../dto/unverified-user-cleanup.dto';
import {
  DeleteUnverifiedUsersResult,
  UnverifiedUserCleanupPage,
} from '../models/unverified-user-cleanup.model';
import { UnverifiedUserCleanupService } from '../services/unverified-user-cleanup.service';

/**
 * Admin endpoints for reviewing and deleting stale unverified accounts.
 */
@ApiTags('Admin User Cleanup')
@ApiBearerAuth()
@Controller('admin/users/unverified-cleanup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UnverifiedUserCleanupController {
  constructor(private readonly unverifiedUserCleanupService: UnverifiedUserCleanupService) {}

  @Get()
  @ApiOperation({ summary: 'List stale unverified participant accounts' })
  @ApiResponse({ status: 200, description: 'Returns eligible cleanup candidates' })
  async listEligibleUsers(
    @Query() query: UnverifiedUserCleanupQueryDto
  ): Promise<UnverifiedUserCleanupPage> {
    return this.unverifiedUserCleanupService.listEligibleUsers(query.page, query.limit);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete selected eligible accounts' })
  @ApiResponse({ status: 200, description: 'Returns deleted accounts and skipped IDs' })
  async deleteEligibleUsers(
    @Body() dto: DeleteUnverifiedUsersDto,
    @Request() request: AuthenticatedRequest
  ): Promise<DeleteUnverifiedUsersResult> {
    return this.unverifiedUserCleanupService.deleteEligibleUsers(dto.ids, request.user.id);
  }
}
