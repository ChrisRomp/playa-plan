import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsBoolean, 
  IsNumber, 
  IsEnum, 
  IsOptional, 
  IsUUID,
  Min,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldType } from '../entities/camping-option-field.entity';

/**
 * DTO for creating a new camping option field
 */
export class CreateCampingOptionFieldDto {
  /**
   * Display name of the field
   */
  @ApiProperty({
    description: 'Display name of the field',
    example: 'Dietary Restrictions',
  })
  @IsString()
  displayName!: string;
  
  /**
   * Description of the field
   */
  @ApiProperty({
    description: 'Description of the field',
    example: 'Please list any dietary restrictions or allergies',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
  
  /**
   * Data type of the field
   */
  @ApiProperty({
    description: 'Data type of the field',
    enum: FieldType,
    example: FieldType.STRING,
  })
  @IsEnum(FieldType)
  dataType!: FieldType;
  
  /**
   * Whether the field is required
   */
  @ApiProperty({
    description: 'Whether the field is required',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  required?: boolean = false;
  
  /**
   * Maximum length for string fields
   */
  @ApiProperty({
    description: 'Maximum length for string fields',
    example: 255,
    required: false,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @ValidateIf(o => o.dataType === FieldType.STRING || o.dataType === FieldType.MULTILINE_STRING)
  @Type(() => Number)
  maxLength?: number;
  
  /**
   * Minimum value for numeric fields
   */
  @ApiProperty({
    description: 'Minimum value for numeric fields',
    example: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @ValidateIf(o => o.dataType === FieldType.NUMBER || o.dataType === FieldType.INTEGER)
  @Type(() => Number)
  minValue?: number;
  
  /**
   * Maximum value for numeric fields
   */
  @ApiProperty({
    description: 'Maximum value for numeric fields',
    example: 100,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @ValidateIf(o => o.dataType === FieldType.NUMBER || o.dataType === FieldType.INTEGER)
  @Type(() => Number)
  maxValue?: number;
  
  /**
   * ID of the camping option this field belongs to
   */
  @ApiProperty({
    description: 'ID of the camping option this field belongs to',
    example: 'c12345-67890',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  campingOptionId?: string;
} 