import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCampingOptionDto, UpdateCampingOptionDto } from '../dto';
import { CampingOption } from '../entities/camping-option.entity';
import { Prisma } from '@prisma/client';

/**
 * Service for managing camping options
 */
@Injectable()
export class CampingOptionsService {
  /**
   * Constructor for the CampingOptionsService
   * @param prisma - The PrismaService for database access
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new camping option
   * @param createCampingOptionDto - The data for creating the camping option
   * @returns The created camping option
   */
  async create(createCampingOptionDto: CreateCampingOptionDto): Promise<CampingOption> {
    try {
      // Validate job category IDs if provided
      if (createCampingOptionDto.jobCategoryIds && createCampingOptionDto.jobCategoryIds.length > 0) {
        const jobCategories = await this.prisma.jobCategory.findMany({
          where: {
            id: {
              in: createCampingOptionDto.jobCategoryIds,
            },
          },
        });

        if (jobCategories.length !== createCampingOptionDto.jobCategoryIds.length) {
          throw new NotFoundException('One or more job categories not found');
        }
      }

      // For create operation
      const campingOption = await this.prisma.campingOption.create({
        data: {
          name: createCampingOptionDto.name,
          description: createCampingOptionDto.description,
          enabled: createCampingOptionDto.enabled ?? true,
          workShiftsRequired: createCampingOptionDto.workShiftsRequired ?? 0,
          participantDues: createCampingOptionDto.participantDues,
          staffDues: createCampingOptionDto.staffDues,
          maxSignups: createCampingOptionDto.maxSignups ?? 0,
          // Set up job categories if provided
          ...(createCampingOptionDto.jobCategoryIds?.length ? {
            jobCategories: {
              create: createCampingOptionDto.jobCategoryIds.map(categoryId => ({
                jobCategory: {
                  connect: { id: categoryId }
                }
              }))
            }
          } : {})
        },
        include: {
          jobCategories: {
            include: {
              jobCategory: true
            }
          }
        }
      });

      // Extract job category IDs from the response
      const jobCategoryIds = campingOption.jobCategories?.map(jc => jc.jobCategory.id) || [];
      
      return new CampingOption({
        ...campingOption,
        jobCategoryIds
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create camping option');
    }
  }

  /**
   * Find all camping options
   * @param includeDisabled - Whether to include disabled options (default: false)
   * @returns Array of camping options
   */
  async findAll(includeDisabled = false): Promise<CampingOption[]> {
    const whereClause: Prisma.CampingOptionWhereInput = {};

    if (!includeDisabled) {
      whereClause.enabled = true;
    }

    const campingOptions = await this.prisma.campingOption.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc',
      },
      include: {
        jobCategories: {
          include: {
            jobCategory: true
          }
        }
      }
    });

    return campingOptions.map(option => {
      const jobCategoryIds = option.jobCategories?.map(jc => jc.jobCategory.id) || [];
      return new CampingOption({
        ...option,
        jobCategoryIds
      });
    });
  }

  /**
   * Find a camping option by ID
   * @param id - The ID of the camping option to find
   * @returns The camping option if found
   */
  async findOne(id: string): Promise<CampingOption> {
    const campingOption = await this.prisma.campingOption.findUnique({
      where: { id },
      include: {
        jobCategories: {
          include: {
            jobCategory: true
          }
        }
      }
    });

    if (!campingOption) {
      throw new NotFoundException(`Camping option with ID ${id} not found`);
    }

    const jobCategoryIds = campingOption.jobCategories?.map(jc => jc.jobCategory.id) || [];
    
    return new CampingOption({
      ...campingOption,
      jobCategoryIds
    });
  }

  /**
   * Get the current registration count for a camping option
   * @param id - The ID of the camping option
   * @returns The number of registrations
   */
  async getRegistrationCount(id: string): Promise<number> {
    const count = await this.prisma.campingOptionRegistration.count({
      where: { campingOptionId: id },
    });

    return count;
  }

  /**
   * Update a camping option
   * @param id - The ID of the camping option to update
   * @param updateCampingOptionDto - The data to update
   * @returns The updated camping option
   */
  async update(id: string, updateCampingOptionDto: UpdateCampingOptionDto): Promise<CampingOption> {
    try {
      // Make sure the camping option exists
      await this.findOne(id);

      // If job category IDs are provided, validate them
      if (updateCampingOptionDto.jobCategoryIds && updateCampingOptionDto.jobCategoryIds.length > 0) {
        const jobCategories = await this.prisma.jobCategory.findMany({
          where: {
            id: {
              in: updateCampingOptionDto.jobCategoryIds,
            },
          },
        });

        if (jobCategories.length !== updateCampingOptionDto.jobCategoryIds.length) {
          throw new NotFoundException('One or more job categories not found');
        }
      }

      // Prepare update data
      const updateData: Prisma.CampingOptionUpdateInput = {};

      if (updateCampingOptionDto.name !== undefined) {
        updateData.name = updateCampingOptionDto.name;
      }

      if (updateCampingOptionDto.description !== undefined) {
        updateData.description = updateCampingOptionDto.description;
      }

      if (updateCampingOptionDto.enabled !== undefined) {
        updateData.enabled = updateCampingOptionDto.enabled;
      }

      if (updateCampingOptionDto.workShiftsRequired !== undefined) {
        updateData.workShiftsRequired = updateCampingOptionDto.workShiftsRequired;
      }

      if (updateCampingOptionDto.participantDues !== undefined) {
        updateData.participantDues = updateCampingOptionDto.participantDues;
      }

      if (updateCampingOptionDto.staffDues !== undefined) {
        updateData.staffDues = updateCampingOptionDto.staffDues;
      }

      if (updateCampingOptionDto.maxSignups !== undefined) {
        updateData.maxSignups = updateCampingOptionDto.maxSignups;
      }

      // Handle job categories if provided
      if (updateCampingOptionDto.jobCategoryIds !== undefined) {
        // Delete existing job category relationships
        await this.prisma.campingOptionJobCategory.deleteMany({
          where: { campingOptionId: id }
        });
        
        // Create new job category relationships if any provided
        if (updateCampingOptionDto.jobCategoryIds.length > 0) {
          await this.prisma.campingOptionJobCategory.createMany({
            data: updateCampingOptionDto.jobCategoryIds.map(categoryId => ({
              campingOptionId: id,
              jobCategoryId: categoryId
            }))
          });
        }
      }

      // Update the camping option itself if there are fields to update
      const updated = await this.prisma.campingOption.update({
        where: { id },
        data: updateData,
        include: {
          jobCategories: {
            include: {
              jobCategory: true
            }
          }
        }
      });

      // Extract job category IDs from the response
      const jobCategoryIds = updated.jobCategories?.map(jc => jc.jobCategory.id) || [];
      
      return new CampingOption({
        ...updated,
        jobCategoryIds
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update camping option');
    }
  }

  /**
   * Remove a camping option
   * @param id - The ID of the camping option to remove
   * @returns The removed camping option
   */
  async remove(id: string): Promise<CampingOption> {
    try {
      // Make sure the camping option exists
      const campingOption = await this.findOne(id);

      // Check if there are any registrations for this option
      const registrationCount = await this.getRegistrationCount(id);
      if (registrationCount > 0) {
        throw new BadRequestException(
          `Cannot delete camping option with ID ${id} because it has ${registrationCount} registrations`
        );
      }

      // Check if there are any fields defined for this option
      const fieldCount = await this.prisma.campingOptionField.count({
        where: { campingOptionId: id },
      });
      
      if (fieldCount > 0) {
        throw new BadRequestException(
          `Cannot delete camping option with ID ${id} because it has ${fieldCount} custom fields. Delete the fields first.`
        );
      }

      await this.prisma.campingOption.delete({
        where: { id },
      });

      return campingOption;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete camping option');
    }
  }
}