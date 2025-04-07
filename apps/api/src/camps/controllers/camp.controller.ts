import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CampsService } from '../services/camps.service';
import { CreateCampDto } from '../dto/create-camp.dto';
import { UpdateCampDto } from '../dto/update-camp.dto';
import { CampResponseDto } from '../dto/camp-response.dto';
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * Controller for managing camp operations
 */
@Controller('camps')
@UseInterceptors(ClassSerializerInterceptor)
export class CampController {
  constructor(private readonly campsService: CampsService) {}

  /**
   * Get all camps
   * @param includeInactive - Optional query parameter to include inactive camps
   * @returns Array of camp response DTOs
   */
  @Get()
  @Public()
  async findAll(@Query('includeInactive') includeInactive?: boolean): Promise<CampResponseDto[]> {
    const camps = await this.campsService.findAll(includeInactive === true);
    return camps.map(camp => new CampResponseDto(camp));
  }

  /**
   * Get current active camps (those occurring now)
   * @returns Array of currently active camp response DTOs
   */
  @Get('current')
  @Public()
  async findCurrent(): Promise<CampResponseDto[]> {
    const camps = await this.campsService.findCurrent();
    return camps.map(camp => new CampResponseDto(camp));
  }

  /**
   * Get upcoming camps (those in the future)
   * @returns Array of upcoming camp response DTOs
   */
  @Get('upcoming')
  @Public()
  async findUpcoming(): Promise<CampResponseDto[]> {
    const camps = await this.campsService.findUpcoming();
    return camps.map(camp => new CampResponseDto(camp));
  }

  /**
   * Get a specific camp by ID
   * @param id - The ID of the camp to retrieve
   * @returns The camp response DTO
   */
  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string): Promise<CampResponseDto> {
    const camp = await this.campsService.findById(id);
    return new CampResponseDto(camp);
  }

  /**
   * Create a new camp (admin only)
   * @param createCampDto - Data to create the camp
   * @returns The newly created camp response DTO
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createCampDto: CreateCampDto): Promise<CampResponseDto> {
    const camp = await this.campsService.create(createCampDto);
    return new CampResponseDto(camp);
  }

  /**
   * Update an existing camp (admin only)
   * @param id - The ID of the camp to update
   * @param updateCampDto - Data to update the camp
   * @returns The updated camp response DTO
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCampDto: UpdateCampDto
  ): Promise<CampResponseDto> {
    const camp = await this.campsService.update(id, updateCampDto);
    return new CampResponseDto(camp);
  }

  /**
   * Delete a camp (admin only)
   * @param id - The ID of the camp to delete
   * @returns Nothing (204 No Content)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    // Check if camp has shifts before deletion
    const hasShifts = await this.campsService.hasShifts(id);
    if (hasShifts) {
      throw new ForbiddenException(
        'Cannot delete a camp with associated shifts. Remove all shifts first.'
      );
    }
    await this.campsService.delete(id);
  }

  /**
   * Smoke test route (admin only)
   * @returns Simple success message
   */
  @Get('admin/test')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async adminTest(): Promise<{ message: string }> {
    return { message: 'Camp controller test successful' };
  }
}