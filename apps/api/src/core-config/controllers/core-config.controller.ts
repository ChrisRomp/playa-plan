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
  BadRequestException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CoreConfigService } from '../services/core-config.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto, CoreConfigResponseDto, PublicCoreConfigDto } from '../dto';
import { UserRole } from '@prisma/client';

/**
 * Controller for managing core configuration
 * 
 * Note: The JwtAuthGuard is applied globally, so we don't need it here.
 * The RolesGuard needs to be applied after specific routes are marked with @Roles().
 * Public routes are marked with @Public() to bypass authentication.
 */
@ApiTags('core-config')
@Controller('core-config')
@UseInterceptors(ClassSerializerInterceptor)
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
  @UseGuards(RolesGuard)
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
   * Update current configuration (Admin only)
   */
  @ApiOperation({ summary: 'Update current configuration' })
  @ApiResponse({
    status: 200,
    description: 'The current configuration has been successfully updated.',
    type: CoreConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Patch('current')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async updateCurrent(@Body() updateCoreConfigDto: UpdateCoreConfigDto): Promise<CoreConfigResponseDto> {
    try {
      // First try to get the current config to get its ID
      try {
        const currentConfig = await this.coreConfigService.findCurrent(false);
        // Update existing config
        const config = await this.coreConfigService.update(currentConfig.id, updateCoreConfigDto);
        return new CoreConfigResponseDto(config);
      } catch (err) {
        if (err instanceof NotFoundException) {
          // No configuration exists yet, so create one
          // We need to convert the UpdateCoreConfigDto to CreateCoreConfigDto
          // Required fields in CreateCoreConfigDto are campName and registrationYear
          if (!updateCoreConfigDto.campName) {
            throw new BadRequestException('Camp name is required when creating a new configuration');
          }
          
          const createDto: CreateCoreConfigDto = {
            campName: updateCoreConfigDto.campName,
            registrationYear: updateCoreConfigDto.registrationYear ?? new Date().getFullYear(),
            ...updateCoreConfigDto
          };
          
          const newConfig = await this.coreConfigService.create(createDto);
          return new CoreConfigResponseDto(newConfig);
        }
        throw err;
      }
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
  @UseGuards(RolesGuard)
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
  @UseGuards(RolesGuard)
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
  @UseGuards(RolesGuard)
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
  @UseGuards(RolesGuard)
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
   * Public endpoint for getting UI configuration elements
   * This endpoint doesn't require authentication
   */
  @ApiOperation({ summary: 'Get public UI configuration' })
  @ApiResponse({
    status: 200,
    description: 'Public UI configuration data.',
    type: PublicCoreConfigDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Public() // Mark as public endpoint - no authentication required
  @Get('public')
  @HttpCode(HttpStatus.OK)
  async getPublicConfig(): Promise<PublicCoreConfigDto> {
    try {
      const config = await this.coreConfigService.findCurrent();
      
      // Map to PublicCoreConfigDto to only expose UI-related fields
      return new PublicCoreConfigDto({
        campName: config.campName,
        campDescription: config.campDescription,
        homePageBlurb: config.homePageBlurb,
        campBannerUrl: config.campBannerUrl,
        campBannerAltText: config.campBannerAltText,
        campIconUrl: config.campIconUrl,
        campIconAltText: config.campIconAltText,
        registrationYear: config.registrationYear,
        earlyRegistrationOpen: config.earlyRegistrationOpen,
        registrationOpen: config.registrationOpen
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Core configuration not found');
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