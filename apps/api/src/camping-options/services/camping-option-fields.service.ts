import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCampingOptionFieldDto, UpdateCampingOptionFieldDto } from '../dto';
import { CampingOptionField } from '../entities/camping-option-field.entity';

/**
 * Service for managing camping option fields
 */
@Injectable()
export class CampingOptionFieldsService {
  /**
   * Constructor for the CampingOptionFieldsService
   * @param prisma - The PrismaService for database access
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new camping option field
   * @param createCampingOptionFieldDto - The data for creating the camping option field
   * @returns The created camping option field
   */
  async create(createCampingOptionFieldDto: CreateCampingOptionFieldDto): Promise<CampingOptionField> {
    try {
      // Verify that the camping option exists
      const campingOption = await this.prisma.$queryRaw`
        SELECT id FROM "camping_options" WHERE id = ${createCampingOptionFieldDto.campingOptionId}::uuid
      `;

      if (!campingOption || !Array.isArray(campingOption) || campingOption.length === 0) {
        throw new NotFoundException(
          `Camping option with ID ${createCampingOptionFieldDto.campingOptionId} not found`
        );
      }

      const field = await this.prisma.$queryRaw`
        INSERT INTO "camping_option_fields" 
        (id, "displayName", description, "dataType", required, "maxLength", "minValue", "maxValue", "campingOptionId", "createdAt", "updatedAt")
        VALUES 
        (
          gen_random_uuid(), 
          ${createCampingOptionFieldDto.displayName}, 
          ${createCampingOptionFieldDto.description || null}, 
          ${createCampingOptionFieldDto.dataType}::text, 
          ${createCampingOptionFieldDto.required || false}, 
          ${createCampingOptionFieldDto.maxLength || null}, 
          ${createCampingOptionFieldDto.minValue || null}, 
          ${createCampingOptionFieldDto.maxValue || null}, 
          ${createCampingOptionFieldDto.campingOptionId}::uuid, 
          now(), 
          now()
        )
        RETURNING *
      `;

      if (!field || !Array.isArray(field) || field.length === 0) {
        throw new BadRequestException('Failed to create camping option field');
      }

      return new CampingOptionField(field[0]);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to create camping option field');
    }
  }

  /**
   * Find all fields for a camping option
   * @param campingOptionId - The ID of the camping option
   * @returns Array of camping option fields
   */
  async findAll(campingOptionId: string): Promise<CampingOptionField[]> {
    const fields = await this.prisma.$queryRaw`
      SELECT * FROM "camping_option_fields" WHERE "campingOptionId" = ${campingOptionId}::uuid
    `;

    if (!fields || !Array.isArray(fields)) {
      return [];
    }

    return fields.map(field => new CampingOptionField(field));
  }

  /**
   * Find a camping option field by ID
   * @param id - The ID of the camping option field to find
   * @returns The camping option field if found
   */
  async findOne(id: string): Promise<CampingOptionField> {
    const fields = await this.prisma.$queryRaw`
      SELECT * FROM "camping_option_fields" WHERE id = ${id}::uuid
    `;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      throw new NotFoundException(`Camping option field with ID ${id} not found`);
    }

    return new CampingOptionField(fields[0]);
  }

  /**
   * Update a camping option field
   * @param id - The ID of the camping option field to update
   * @param updateCampingOptionFieldDto - The data to update
   * @returns The updated camping option field
   */
  async update(
    id: string, 
    updateCampingOptionFieldDto: UpdateCampingOptionFieldDto
  ): Promise<CampingOptionField> {
    try {
      // Make sure the field exists
      await this.findOne(id);

      // Build the SET clause dynamically
      const setClause = Object.entries(updateCampingOptionFieldDto)
        .filter(([key, value]) => value !== undefined)
        .map(([key, value]) => {
          if (value === null) {
            return `"${key}" = NULL`;
          }
          if (typeof value === 'boolean') {
            return `"${key}" = ${value}`;
          }
          if (key === 'dataType') {
            return `"${key}" = ${value}::text`;
          }
          return `"${key}" = ${JSON.stringify(value)}`;
        })
        .join(', ');

      if (!setClause) {
        // No fields to update
        return this.findOne(id);
      }

      const query = `
        UPDATE "camping_option_fields"
        SET ${setClause}, "updatedAt" = now()
        WHERE id = '${id}'
        RETURNING *
      `;

      const updatedFields = await this.prisma.$queryRawUnsafe(query);

      if (!updatedFields || !Array.isArray(updatedFields) || updatedFields.length === 0) {
        throw new NotFoundException(`Camping option field with ID ${id} not found`);
      }

      return new CampingOptionField(updatedFields[0]);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to update camping option field');
    }
  }

  /**
   * Remove a camping option field
   * @param id - The ID of the camping option field to remove
   * @returns The removed camping option field
   */
  async remove(id: string): Promise<CampingOptionField> {
    try {
      // Make sure the field exists
      const field = await this.findOne(id);

      await this.prisma.$queryRaw`
        DELETE FROM "camping_option_fields" WHERE id = ${id}::uuid
      `;

      return field;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to delete camping option field');
    }
  }
} 