import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CampingOptionFieldsService } from '../services/camping-option-fields.service';
import { CampingOptionsService } from '../services/camping-options.service';
import { 
  CreateCampingOptionFieldDto, 
  UpdateCampingOptionFieldDto,
  CampingOptionFieldResponseDto 
} from '../dto';
import { UserRole } from '@prisma/client';

/**
 * DTO for reordering fields
 */
class ReorderFieldsDto {
  fieldOrders!: Array<{ id: string; order: number }>;
}

/**
 * Controller for managing camping option fields
 */
@ApiTags('camping-option-fields')
@Controller('camping-option-fields')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CampingOptionFieldsController {
  constructor(private readonly campingOptionFieldsService: CampingOptionFieldsService) {}

  /**
   * Create a new camping option field (Admin only)
   */
  @ApiOperation({ summary: 'Create a new camping option field' })
  @ApiResponse({ 
    status: 201, 
    description: 'The camping option field has been successfully created.',
    type: CampingOptionFieldResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createCampingOptionFieldDto: CreateCampingOptionFieldDto): Promise<CampingOptionFieldResponseDto> {
    const field = await this.campingOptionFieldsService.create(createCampingOptionFieldDto);
    return field as CampingOptionFieldResponseDto;
  }

  /**
   * Get all fields for a camping option
   */
  @ApiOperation({ summary: 'Get all fields for a camping option' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of camping option fields',
    type: [CampingOptionFieldResponseDto],
  })
  @ApiParam({ name: 'campingOptionId', description: 'The ID of the camping option' })
  @Get('by-camping-option/:campingOptionId')
  async findAll(@Param('campingOptionId') campingOptionId: string): Promise<CampingOptionFieldResponseDto[]> {
    const fields = await this.campingOptionFieldsService.findAll(campingOptionId);
    return fields as CampingOptionFieldResponseDto[];
  }

  /**
   * Get a specific camping option field by ID
   */
  @ApiOperation({ summary: 'Get a camping option field by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option field',
    type: CampingOptionFieldResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Camping option field not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option field' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CampingOptionFieldResponseDto> {
    try {
      const field = await this.campingOptionFieldsService.findOne(id);
      return field as CampingOptionFieldResponseDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Camping option field with ID ${id} not found`);
    }
  }

  /**
   * Update a camping option field (Admin only)
   */
  @ApiOperation({ summary: 'Update a camping option field' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option field has been successfully updated.',
    type: CampingOptionFieldResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Camping option field not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option field' })
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string, 
    @Body() updateCampingOptionFieldDto: UpdateCampingOptionFieldDto
  ): Promise<CampingOptionFieldResponseDto> {
    const field = await this.campingOptionFieldsService.update(id, updateCampingOptionFieldDto);
    return field as CampingOptionFieldResponseDto;
  }

  /**
   * Delete a camping option field (Admin only)
   */
  @ApiOperation({ summary: 'Delete a camping option field' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option field has been successfully deleted.',
    type: CampingOptionFieldResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Camping option field not found' })
  @ApiParam({ name: 'id', description: 'The ID of the camping option field' })
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<CampingOptionFieldResponseDto> {
    const field = await this.campingOptionFieldsService.remove(id);
    return field as CampingOptionFieldResponseDto;
  }

  /**
   * Reorder camping option fields (Admin only)
   */
  @ApiOperation({ summary: 'Reorder camping option fields' })
  @ApiResponse({ 
    status: 200, 
    description: 'The camping option fields have been successfully reordered.',
    type: [CampingOptionFieldResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Camping option not found' })
  @ApiParam({ name: 'campingOptionId', description: 'The ID of the camping option' })
  @ApiBody({ 
    description: 'Array of field IDs with their new order values',
    schema: {
      type: 'object',
      properties: {
        fieldOrders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Field ID' },
              order: { type: 'number', description: 'New order value' }
            },
            required: ['id', 'order']
          }
        }
      },
      required: ['fieldOrders']
    }
  })
  @Patch('reorder/:campingOptionId')
  @Roles(UserRole.ADMIN)
  async reorderFields(
    @Param('campingOptionId') campingOptionId: string,
    @Body() reorderDto: ReorderFieldsDto
  ): Promise<CampingOptionFieldResponseDto[]> {
    const fields = await this.campingOptionFieldsService.reorderFields(campingOptionId, reorderDto.fieldOrders);
    return fields as CampingOptionFieldResponseDto[];
  }
} 