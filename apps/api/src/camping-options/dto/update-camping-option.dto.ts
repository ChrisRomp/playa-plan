import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsBoolean, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  Min, 
  IsUUID,
  ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating an existing camping option
 */
export class UpdateCampingOptionDto {
  /**
   * Name of the camping option
   */
  @ApiProperty({
    description: 'Name of the camping option',
    example: 'Standard Camping',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
  
  /**
   * Description of the camping option
   */
  @ApiProperty({
    description: 'Description of the camping option',
    example: 'Standard camping option with shared facilities',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
  
  /**
   * Whether the camping option is enabled
   */
  @ApiProperty({
    description: 'Whether the camping option is enabled',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
  
  /**
   * Number of work shifts required for this camping option
   */
  @ApiProperty({
    description: 'Number of work shifts required for this camping option',
    example: 2,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  workShiftsRequired?: number;
  
  /**
   * Dues amount for participants
   */
  @ApiProperty({
    description: 'Dues amount for participants',
    example: 250.00,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  participantDues?: number;
  
  /**
   * Dues amount for staff
   */
  @ApiProperty({
    description: 'Dues amount for staff',
    example: 150.00,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  staffDues?: number;
  
  /**
   * Maximum number of sign-ups allowed (0 = unlimited)
   */
  @ApiProperty({
    description: 'Maximum number of sign-ups allowed (0 = unlimited)',
    example: 50,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxSignups?: number;
  
  /**
   * Array of job category IDs required for this camping option
   */
  @ApiProperty({
    description: 'Array of job category IDs required for this camping option',
    example: ['jc1', 'jc2'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  @ArrayMinSize(0)
  jobCategoryIds?: string[];
} 