import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CampingOptionsService } from '../services/camping-options.service';
import { 
  CreateCampingOptionDto, 
  UpdateCampingOptionDto,
  CampingOptionResponseDto 
} from '../dto';
import { CampingOption } from '../entities/camping-option.entity';
import { UserRole } from '@prisma/client';

/**
 * Controller for managing camping options
 */
@ApiTags('camping-options')
@Controller('camping-options')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CampingOptionsController {
  constructor(private readonly campingOptionsService: CampingOptionsService) {}

  /**
   * Create a new camping option (Admin only)
   */
  @ApiOperation({ summary: 'Create a new camping option' })
  @ApiResponse({ 
    status: 201, 
    description: 'The camping option has been successfully created.',
    type: CampingOptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createCampingOptionDto: CreateCampingOptionDto): Promise<CampingOptionResponseDto> {
    const campingOption = await this.campingOptionsService.create(createCampingOptionDto);
    const responseDto = new CampingOptionResponseDto();
    
    Object.assign(responseDto, campingOption);
    
    // Add computed properties
    responseDto.currentRegistrations = 0;
    responseDto.availabilityStatus = campingOption.enabled;
    
    return responseDto;
  }

  /**
   * Get all camping options with optional filtering
   */
  @ApiOperation({ summary: 'Get all camping options' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of camping options',
    type: [CampingOptionResponseDto],
  })
  @ApiQuery({ name: 'includeDisabled', required: false, type: Boolean })
  @ApiQuery({ name: 'campId', required: false, type: String })
  @Get()
  async findAll(
    @Query('includeDisabled') includeDisabled?: boolean | string,
    @Query('campId') campId?: string,
  ): Promise<CampingOptionResponseDto[]> {
    const campingOptions = await this.campingOptionsService.findAll(
      includeDisabled === true || includeDisabled === 'true', 
      campId
    );
    
    const responseDtos: CampingOptionResponseDto[] = [];
    
    for (const option of campingOptions) {
      const registrationCount = await this.campingOptionsService.getRegistrationCount(option.id);
      const responseDto = new CampingOptionResponseDto();
      
      Object.assign(responseDto, option);
      
      // Add computed properties
      responseDto.currentRegistrations = registrationCount;
      responseDto.availabilityStatus = option.isAvailable(registrationCount);
      
      responseDtos.push(responseDto);
    }
    
    return responseDtos;
  }

  /**
   * Get a specific camping option by ID
   */
  @ApiOperation({ summary: 'Get a camping option by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option',
    type: CampingOptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Camping option not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CampingOptionResponseDto> {
    try {
      const campingOption = await this.campingOptionsService.findOne(id);
      const registrationCount = await this.campingOptionsService.getRegistrationCount(id);
      const responseDto = new CampingOptionResponseDto();
      
      Object.assign(responseDto, campingOption);
      
      // Add computed properties
      responseDto.currentRegistrations = registrationCount;
      responseDto.availabilityStatus = campingOption.isAvailable(registrationCount);
      
      return responseDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Camping option with ID ${id} not found`);
    }
  }

  /**
   * Update a camping option (Admin only)
   */
  @ApiOperation({ summary: 'Update a camping option' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option has been successfully updated.',
    type: CampingOptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Camping option not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option' })
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string, 
    @Body() updateCampingOptionDto: UpdateCampingOptionDto
  ): Promise<CampingOptionResponseDto> {
    const campingOption = await this.campingOptionsService.update(id, updateCampingOptionDto);
    const registrationCount = await this.campingOptionsService.getRegistrationCount(id);
    const responseDto = new CampingOptionResponseDto();
    
    Object.assign(responseDto, campingOption);
    
    // Add computed properties
    responseDto.currentRegistrations = registrationCount;
    responseDto.availabilityStatus = campingOption.isAvailable(registrationCount);
    
    return responseDto;
  }

  /**
   * Delete a camping option (Admin only)
   */
  @ApiOperation({ summary: 'Delete a camping option' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option has been successfully deleted.',
    type: CampingOptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - cannot delete option with registrations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Camping option not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option' })
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<CampingOptionResponseDto> {
    const campingOption = await this.campingOptionsService.remove(id);
    const responseDto = new CampingOptionResponseDto();
    
    Object.assign(responseDto, campingOption);
    
    // Add computed properties
    responseDto.currentRegistrations = 0;
    responseDto.availabilityStatus = false;
    
    return responseDto;
  }
} 