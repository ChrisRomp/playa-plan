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
 * DTO for creating a new camping option
 */
export class CreateCampingOptionDto {
  /**
   * Name of the camping option
   */
  @ApiProperty({
    description: 'Name of the camping option',
    example: 'Standard Camping',
  })
  @IsString()
  name!: string;
  
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
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;
  
  /**
   * Number of work shifts required for this camping option
   */
  @ApiProperty({
    description: 'Number of work shifts required for this camping option',
    example: 2,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  workShiftsRequired?: number = 0;
  
  /**
   * Dues amount for participants
   */
  @ApiProperty({
    description: 'Dues amount for participants',
    example: 250.00,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  participantDues!: number;
  
  /**
   * Dues amount for staff
   */
  @ApiProperty({
    description: 'Dues amount for staff',
    example: 150.00,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  staffDues!: number;
  
  /**
   * Maximum number of sign-ups allowed (0 = unlimited)
   */
  @ApiProperty({
    description: 'Maximum number of sign-ups allowed (0 = unlimited)',
    example: 50,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxSignups?: number = 0;
  
  /**
   * ID of the camp this option belongs to
   */
  @ApiProperty({
    description: 'ID of the camp this option belongs to',
    example: 'c12345-67890',
  })
  @IsUUID()
  campId!: string;
  
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
  jobCategoryIds?: string[] = [];
} 