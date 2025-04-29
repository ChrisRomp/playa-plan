import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCampingOptionDto, UpdateCampingOptionDto } from '../dto';
import { CampingOption } from '../entities/camping-option.entity';

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
      // Verify that the camp exists
      const camp = await this.prisma.camp.findUnique({
        where: { id: createCampingOptionDto.campId },
      });

      if (!camp) {
        throw new NotFoundException(`Camp with ID ${createCampingOptionDto.campId} not found`);
      }

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
          camp: { connect: { id: createCampingOptionDto.campId } },
          jobCategoryIds: createCampingOptionDto.jobCategoryIds || [],
        },
      });

      return new CampingOption(campingOption);
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
   * @param campId - Optional campId to filter by
   * @returns Array of camping options
   */
  async findAll(includeDisabled = false, campId?: string): Promise<CampingOption[]> {
    let query = `SELECT * FROM "camping_options" WHERE 1=1`;
    
    if (!includeDisabled) {
      query += ` AND enabled = true`;
    }
    
    if (campId) {
      query += ` AND "campId" = '${campId}'`;
    }
    
    query += ` ORDER BY name ASC`;
    
    const results = await this.prisma.$queryRawUnsafe(query);
    
    if (!results || !Array.isArray(results)) {
      return [];
    }
    
    return results.map(option => new CampingOption(option));
  }

  /**
   * Find a camping option by ID
   * @param id - The ID of the camping option to find
   * @returns The camping option if found
   */
  async findOne(id: string): Promise<CampingOption> {
    const results = await this.prisma.$queryRaw`
      SELECT * FROM "camping_options" WHERE id = ${id}::uuid
    `;

    if (!results || !Array.isArray(results) || results.length === 0) {
      throw new NotFoundException(`Camping option with ID ${id} not found`);
    }

    return new CampingOption(results[0]);
  }

  /**
   * Get the current registration count for a camping option
   * @param id - The ID of the camping option
   * @returns The number of registrations
   */
  async getRegistrationCount(id: string): Promise<number> {
    const result = await this.prisma.$queryRaw`
      SELECT COUNT(*) AS count FROM "camping_option_registrations" WHERE "campingOptionId" = ${id}::uuid
    `;

    if (!result || !Array.isArray(result) || result.length === 0) {
      return 0;
    }
    
    return parseInt(result[0].count, 10) || 0;
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

      // Build the SET clause dynamically
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updateCampingOptionDto.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updateCampingOptionDto.name);
      }

      if (updateCampingOptionDto.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updateCampingOptionDto.description);
      }

      if (updateCampingOptionDto.enabled !== undefined) {
        setClauses.push(`enabled = $${paramIndex++}`);
        values.push(updateCampingOptionDto.enabled);
      }

      if (updateCampingOptionDto.workShiftsRequired !== undefined) {
        setClauses.push(`"workShiftsRequired" = $${paramIndex++}`);
        values.push(updateCampingOptionDto.workShiftsRequired);
      }

      if (updateCampingOptionDto.participantDues !== undefined) {
        setClauses.push(`"participantDues" = $${paramIndex++}`);
        values.push(updateCampingOptionDto.participantDues);
      }

      if (updateCampingOptionDto.staffDues !== undefined) {
        setClauses.push(`"staffDues" = $${paramIndex++}`);
        values.push(updateCampingOptionDto.staffDues);
      }

      if (updateCampingOptionDto.maxSignups !== undefined) {
        setClauses.push(`"maxSignups" = $${paramIndex++}`);
        values.push(updateCampingOptionDto.maxSignups);
      }

      if (updateCampingOptionDto.jobCategoryIds !== undefined) {
        const jobCategoryIdsArray = JSON.stringify(updateCampingOptionDto.jobCategoryIds)
          .replace(/\[/g, '{')
          .replace(/\]/g, '}');
        setClauses.push(`"jobCategoryIds" = $${paramIndex++}::text[]`);
        values.push(jobCategoryIdsArray);
      }

      if (setClauses.length === 0) {
        // No fields to update
        return this.findOne(id);
      }

      setClauses.push(`"updatedAt" = now()`);

      const query = `
        UPDATE "camping_options"
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      values.push(id);

      const result = await this.prisma.$queryRawUnsafe(query, ...values);

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new NotFoundException(`Camping option with ID ${id} not found`);
      }

      return new CampingOption(result[0]);
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

      // Also check if there are any fields defined for this option
      const fieldResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) AS count FROM "camping_option_fields" WHERE "campingOptionId" = ${id}::uuid
      `;

      if (fieldResult && Array.isArray(fieldResult) && fieldResult.length > 0) {
        const fieldCount = parseInt(fieldResult[0].count, 10) || 0;
        if (fieldCount > 0) {
          throw new BadRequestException(
            `Cannot delete camping option with ID ${id} because it has ${fieldCount} custom fields. Delete the fields first.`
          );
        }
      }

      await this.prisma.$queryRaw`
        DELETE FROM "camping_options" WHERE id = ${id}::uuid
      `;

      return campingOption;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete camping option');
    }
  }
}