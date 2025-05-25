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

  private mapToEntity(field: {
    id: string;
    displayName: string;
    description: string | null;
    dataType: string;
    required: boolean;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
    order: number;
    campingOptionId: string;
    createdAt: Date;
    updatedAt: Date;
  }): CampingOptionField {
    return new CampingOptionField({
      id: field.id,
      displayName: field.displayName,
      description: field.description,
      dataType: field.dataType as import('../entities/camping-option-field.entity').FieldType,
      required: field.required,
      maxLength: field.maxLength,
      minValue: field.minValue,
      maxValue: field.maxValue,
      order: field.order,
      campingOptionId: field.campingOptionId,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    });
  }

  async create(createCampingOptionFieldDto: CreateCampingOptionFieldDto): Promise<CampingOptionField> {
    try {
      // Verify that the camping option exists
      const campingOption = await this.prisma.campingOption.findUnique({
        where: { id: createCampingOptionFieldDto.campingOptionId },
        select: { id: true },
      });
      if (!campingOption) {
        throw new NotFoundException(
          `Camping option with ID ${createCampingOptionFieldDto.campingOptionId} not found`
        );
      }
      
      // If no order is specified, assign the next available order
      let order = createCampingOptionFieldDto.order;
      if (order === undefined || order === null) {
        const maxOrderField = await this.prisma.campingOptionField.findFirst({
          where: { campingOptionId: createCampingOptionFieldDto.campingOptionId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        order = (maxOrderField?.order ?? -1) + 1;
      }
      
      const field = await this.prisma.campingOptionField.create({
        data: {
          displayName: createCampingOptionFieldDto.displayName,
          description: createCampingOptionFieldDto.description ?? null,
          dataType: createCampingOptionFieldDto.dataType,
          required: createCampingOptionFieldDto.required ?? false,
          maxLength: createCampingOptionFieldDto.maxLength ?? null,
          minValue: createCampingOptionFieldDto.minValue ?? null,
          maxValue: createCampingOptionFieldDto.maxValue ?? null,
          order: order,
          campingOption: { connect: { id: createCampingOptionFieldDto.campingOptionId } },
        },
      });
      return this.mapToEntity(field);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create camping option field');
    }
  }

  async findAll(campingOptionId: string): Promise<CampingOptionField[]> {
    const fields = await this.prisma.campingOptionField.findMany({
      where: { campingOptionId },
      orderBy: { order: 'asc' },
    });
    return fields.map(field => this.mapToEntity(field));
  }

  /**
   * Find a camping option field by ID
   * @param id - The ID of the camping option field to find
   * @returns The camping option field if found
   */
  async findOne(id: string): Promise<CampingOptionField> {
    const field = await this.prisma.campingOptionField.findUnique({
      where: { id },
    });
    if (!field) {
      throw new NotFoundException(`Camping option field with ID ${id} not found`);
    }
    return this.mapToEntity(field);
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
      const updatedField = await this.prisma.campingOptionField.update({
        where: { id },
        data: {
          ...updateCampingOptionFieldDto,
          updatedAt: new Date(),
        },
      });
      return this.mapToEntity(updatedField);
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
      await this.prisma.campingOptionField.delete({
        where: { id },
      });
      return field;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete camping option field');
    }
  }

  /**
   * Reorder camping option fields
   * @param campingOptionId - The ID of the camping option
   * @param fieldOrders - Array of field IDs with their new order values
   * @returns The updated fields
   */
  async reorderFields(
    campingOptionId: string,
    fieldOrders: Array<{ id: string; order: number }>
  ): Promise<CampingOptionField[]> {
    try {
      // Verify that the camping option exists
      const campingOption = await this.prisma.campingOption.findUnique({
        where: { id: campingOptionId },
        select: { id: true },
      });
      if (!campingOption) {
        throw new NotFoundException(`Camping option with ID ${campingOptionId} not found`);
      }

      // Verify all field IDs belong to this camping option
      const existingFields = await this.prisma.campingOptionField.findMany({
        where: { 
          campingOptionId,
          id: { in: fieldOrders.map(fo => fo.id) }
        },
        select: { id: true },
      });

      if (existingFields.length !== fieldOrders.length) {
        throw new BadRequestException('One or more field IDs are invalid or do not belong to this camping option');
      }

      // Update the order for each field
      await Promise.all(
        fieldOrders.map(({ id, order }) =>
          this.prisma.campingOptionField.update({
            where: { id },
            data: { order },
          })
        )
      );

      // Return the updated fields
      return this.findAll(campingOptionId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to reorder camping option fields');
    }
  }
}