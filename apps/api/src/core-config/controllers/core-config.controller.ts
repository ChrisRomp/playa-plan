import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CoreConfigService } from '../services/core-config.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto, CoreConfigResponseDto } from '../dto';
import { UserRole } from '@prisma/client';

/**
 * Controller for managing core configuration
 */
@ApiTags('core-config')
@Controller('core-config')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CoreConfigController {
  constructor(private readonly coreConfigService: CoreConfigService) {}

  /**
   * Create a new core configuration (Admin only)
   */
  @ApiOperation({ summary: 'Create a new core configuration' })
  @ApiResponse({
    status: 201,
    description: 'The core configuration has been successfully created.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - configuration already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createCoreConfigDto: CreateCoreConfigDto): Promise<CoreConfigResponseDto> {
    try {
      const config = await this.coreConfigService.create(createCoreConfigDto);
      return new CoreConfigResponseDto(config);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create core configuration');
    }
  }

  /**
   * Get current configuration (available to all authenticated users)
   */
  @ApiOperation({ summary: 'Get current configuration' })
  @ApiResponse({
    status: 200,
    description: 'The current core configuration.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get('current')
  async findCurrent(): Promise<CoreConfigResponseDto> {
    try {
      const config = await this.coreConfigService.findCurrent();
      return new CoreConfigResponseDto(config);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Core configuration not found');
    }
  }

  /**
   * Get all configurations (Admin only)
   */
  @ApiOperation({ summary: 'Get all configurations' })
  @ApiResponse({
    status: 200,
    description: 'List of all core configurations.',
    type: [CoreConfigResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(): Promise<CoreConfigResponseDto[]> {
    const configs = await this.coreConfigService.findAll();
    return configs.map(config => new CoreConfigResponseDto(config));
  }

  /**
   * Get a specific configuration by ID (Admin only)
   */
  @ApiOperation({ summary: 'Get a specific configuration by ID' })
  @ApiResponse({
    status: 200,
    description: 'The core configuration.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiParam({ name: 'id', description: 'The ID of the core configuration' })
  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string): Promise<CoreConfigResponseDto> {
    try {
      const config = await this.coreConfigService.findOne(id);
      return new CoreConfigResponseDto(config);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Core configuration with ID ${id} not found`);
    }
  }

  /**
   * Update a configuration (Admin only)
   */
  @ApiOperation({ summary: 'Update a configuration' })
  @ApiResponse({
    status: 200,
    description: 'The core configuration has been successfully updated.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiParam({ name: 'id', description: 'The ID of the core configuration' })
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCoreConfigDto: UpdateCoreConfigDto
  ): Promise<CoreConfigResponseDto> {
    try {
      const config = await this.coreConfigService.update(id, updateCoreConfigDto);
      return new CoreConfigResponseDto(config);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update core configuration');
    }
  }

  /**
   * Delete a configuration (Admin only)
   */
  @ApiOperation({ summary: 'Delete a configuration' })
  @ApiResponse({
    status: 200,
    description: 'The core configuration has been successfully deleted.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiParam({ name: 'id', description: 'The ID of the core configuration' })
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<CoreConfigResponseDto> {
    try {
      const config = await this.coreConfigService.remove(id);
      return new CoreConfigResponseDto(config);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete core configuration');
    }
  }

  /**
   * Admin test endpoint
   */
  @ApiOperation({ summary: 'Admin test endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Test response.',
    type: String,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @Get('admin/test')
  @Roles(UserRole.ADMIN)
  @UseInterceptors() // Override the controller-level interceptors
  adminTest(): { message: string } {
    // Return an object instead of a string to avoid problems with UserTransformInterceptor
    return { message: this.coreConfigService.adminTest() };
  }
} 