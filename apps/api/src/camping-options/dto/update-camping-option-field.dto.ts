import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsBoolean, 
  IsNumber, 
  IsEnum, 
  IsOptional, 
  Min,
  MinLength,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldType } from '../entities/camping-option-field.entity';

/**
 * DTO for updating an existing camping option field
 */
export class UpdateCampingOptionFieldDto {
  /**
   * Display name of the field
   */
  @ApiProperty({
    description: 'Display name of the field',
    example: 'Dietary Restrictions',
    minLength: 1,
    required: false,
  })
  @IsString()
  @MinLength(1, { message: 'Display name must be at least 1 character long' })
  @IsOptional()
  displayName?: string;
  
  /**
   * Description of the field
   */
  @ApiProperty({
    description: 'Description of the field',
    example: 'Please list any dietary restrictions or allergies',
    minLength: 1,
    required: false,
  })
  @IsString()
  @MinLength(1, { message: 'Description must be at least 1 character long' })
  @IsOptional()
  description?: string;
  
  /**
   * Data type of the field
   */
  @ApiProperty({
    description: 'Data type of the field',
    enum: FieldType,
    example: FieldType.STRING,
    required: false,
  })
  @IsEnum(FieldType)
  @IsOptional()
  dataType?: FieldType;
  
  /**
   * Whether the field is required
   */
  @ApiProperty({
    description: 'Whether the field is required',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  required?: boolean;
  
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
  @ValidateIf(o => !o.dataType || o.dataType === FieldType.STRING || o.dataType === FieldType.MULTILINE_STRING)
  @Type(() => Number)
  maxLength?: number;
  
  /**
   * Minimum length for string fields
   */
  @ApiProperty({
    description: 'Minimum length for string fields',
    example: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @ValidateIf(o => !o.dataType || o.dataType === FieldType.STRING || o.dataType === FieldType.MULTILINE_STRING)
  @Type(() => Number)
  minLength?: number;
  
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
  @ValidateIf(o => !o.dataType || o.dataType === FieldType.NUMBER || o.dataType === FieldType.INTEGER)
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
  @ValidateIf(o => !o.dataType || o.dataType === FieldType.NUMBER || o.dataType === FieldType.INTEGER)
  @Type(() => Number)
  maxValue?: number;
  
  /**
   * Display order of the field
   */
  @ApiProperty({
    description: 'Display order of the field (lower numbers appear first)',
    example: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  order?: number;
} 