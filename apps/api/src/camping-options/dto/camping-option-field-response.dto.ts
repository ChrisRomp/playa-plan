import { ApiProperty } from '@nestjs/swagger';
import { FieldType } from '../entities/camping-option-field.entity';

/**
 * DTO for camping option field API responses
 */
export class CampingOptionFieldResponseDto {
  /**
   * Unique identifier for the camping option field
   */
  @ApiProperty({
    description: 'Unique identifier for the camping option field',
    example: 'f12345-67890'
  })
  id!: string;
  
  /**
   * Display name of the field
   */
  @ApiProperty({
    description: 'Display name of the field',
    example: 'Dietary Restrictions'
  })
  displayName!: string;
  
  /**
   * Description of the field
   */
  @ApiProperty({
    description: 'Description of the field',
    example: 'Please list any dietary restrictions or allergies',
    nullable: true
  })
  description!: string | null;
  
  /**
   * Data type of the field
   */
  @ApiProperty({
    description: 'Data type of the field',
    enum: FieldType,
    example: FieldType.STRING
  })
  dataType!: FieldType;
  
  /**
   * Whether the field is required
   */
  @ApiProperty({
    description: 'Whether the field is required',
    example: false
  })
  required!: boolean;
  
  /**
   * Maximum length for string fields
   */
  @ApiProperty({
    description: 'Maximum length for string fields',
    example: 255,
    nullable: true
  })
  maxLength!: number | null;
  
  /**
   * Minimum value for numeric fields
   */
  @ApiProperty({
    description: 'Minimum value for numeric fields',
    example: 0,
    nullable: true
  })
  minValue!: number | null;
  
  /**
   * Maximum value for numeric fields
   */
  @ApiProperty({
    description: 'Maximum value for numeric fields',
    example: 100,
    nullable: true
  })
  maxValue!: number | null;
  
  /**
   * ID of the camping option this field belongs to
   */
  @ApiProperty({
    description: 'ID of the camping option this field belongs to',
    example: 'c12345-67890'
  })
  campingOptionId!: string;
  
  /**
   * Date when the field was created
   */
  @ApiProperty({
    description: 'Date when the field was created',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt!: Date;
  
  /**
   * Date when the field was last updated
   */
  @ApiProperty({
    description: 'Date when the field was last updated',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt!: Date;
} 