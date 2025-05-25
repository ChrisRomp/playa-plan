import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for a single field order entry
 */
export class FieldOrderDto {
  /**
   * The ID of the field
   */
  @ApiProperty({
    description: 'The ID of the field',
    example: 'e3e4f056-ee1c-4729-80a1-4611403e2217'
  })
  @IsUUID()
  id!: string;

  /**
   * The new order value for the field
   */
  @ApiProperty({
    description: 'The new order value for the field (0-based index)',
    example: 0,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  order!: number;
}

/**
 * DTO for reordering camping option fields
 */
export class ReorderFieldsDto {
  /**
   * Array of field IDs with their new order values
   */
  @ApiProperty({
    description: 'Array of field IDs with their new order values',
    type: [FieldOrderDto],
    example: [
      { id: 'e3e4f056-ee1c-4729-80a1-4611403e2217', order: 0 },
      { id: 'dad1fd3b-a10c-4fd5-9fdc-2067c63c6a12', order: 1 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOrderDto)
  fieldOrders!: FieldOrderDto[];
} 