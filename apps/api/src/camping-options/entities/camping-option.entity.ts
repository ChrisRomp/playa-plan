import { ApiProperty } from '@nestjs/swagger';

/**
 * Entity representing a camping option in the system
 * Maps to the CampingOption model in Prisma
 */
export class CampingOption {
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
    example: true,
    default: true
  })
  enabled!: boolean;
  
  /**
   * Number of work shifts required for this camping option
   */
  @ApiProperty({
    description: 'Number of work shifts required for this camping option',
    example: 2,
    default: 0
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
    example: 50,
    default: 0
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
  
  constructor(partial: Partial<CampingOption>) {
    Object.assign(this, partial);
  }
  
  /**
   * Checks if this camping option is available for signups
   */
  isAvailable(currentSignups: number): boolean {
    if (!this.enabled) return false;
    
    // If maxSignups is 0, there's no limit
    if (this.maxSignups === 0) return true;
    
    return currentSignups < this.maxSignups;
  }
  
  /**
   * Calculate dues based on user role
   */
  getDuesForRole(isStaff: boolean): number {
    return isStaff ? this.staffDues : this.participantDues;
  }
} 