import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CampingOption } from '../entities/camping-option.entity';

/**
 * DTO for camping option API responses
 */
export class CampingOptionResponseDto implements Partial<CampingOption> {
  /**
   * Unique identifier for the camping option
   */
  @ApiProperty({
    description: 'Unique identifier for the camping option',
    example: 'c12345-67890'
  })
  id!: string;
  
  /**
   * Name of the camping option
   */
  @ApiProperty({
    description: 'Name of the camping option',
    example: 'Standard Camping'
  })
  name!: string;
  
  /**
   * Description of the camping option
   */
  @ApiProperty({
    description: 'Description of the camping option',
    example: 'Standard camping option with shared facilities',
    nullable: true
  })
  description!: string | null;
  
  /**
   * Whether the camping option is enabled
   */
  @ApiProperty({
    description: 'Whether the camping option is enabled',
    example: true
  })
  enabled!: boolean;
  
  /**
   * Number of work shifts required for this camping option
   */
  @ApiProperty({
    description: 'Number of work shifts required for this camping option',
    example: 2
  })
  workShiftsRequired!: number;
  
  /**
   * Dues amount for participants
   */
  @ApiProperty({
    description: 'Dues amount for participants',
    example: 250.00
  })
  participantDues!: number;
  
  /**
   * Dues amount for staff
   */
  @ApiProperty({
    description: 'Dues amount for staff',
    example: 150.00
  })
  staffDues!: number;
  
  /**
   * Maximum number of sign-ups allowed (0 = unlimited)
   */
  @ApiProperty({
    description: 'Maximum number of sign-ups allowed (0 = unlimited)',
    example: 50
  })
  maxSignups!: number;
  
  /**
   * ID of the camp this option belongs to
   */
  @ApiProperty({
    description: 'ID of the camp this option belongs to',
    example: 'c12345-67890'
  })
  campId!: string;
  
  /**
   * Array of job category IDs required for this camping option
   */
  @ApiProperty({
    description: 'Array of job category IDs required for this camping option',
    example: ['jc1', 'jc2'],
    type: [String]
  })
  jobCategoryIds!: string[];
  
  /**
   * Date when the camping option was created
   */
  @ApiProperty({
    description: 'Date when the camping option was created',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt!: Date;
  
  /**
   * Date when the camping option was last updated
   */
  @ApiProperty({
    description: 'Date when the camping option was last updated',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt!: Date;
  
  /**
   * Number of current registrations for this camping option
   */
  @ApiProperty({
    description: 'Number of current registrations for this camping option',
    example: 25
  })
  @Expose()
  currentRegistrations?: number;
  
  /**
   * Whether this camping option is available for sign-ups
   */
  @ApiProperty({
    description: 'Whether this camping option is available for sign-ups',
    example: true
  })
  @Expose()
  availabilityStatus?: boolean;
} 