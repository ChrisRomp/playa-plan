import { Exclude, Expose, Transform } from 'class-transformer';
import { Camp } from '../entities/camp.entity';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for camp API responses
 */
export class CampResponseDto implements Partial<Camp> {
  /**
   * Unique identifier for the camp
   */
  @ApiProperty({
    description: 'Unique identifier of the camp',
    example: 'c12345-67890',
  })
  id!: string;
  
  /**
   * Name of the camp session
   */
  @ApiProperty({
    description: 'Name of the camp',
    example: 'Summer Camp 2025',
  })
  name!: string;
  
  /**
   * Description of the camp session
   */
  @ApiProperty({
    description: 'Description of the camp',
    example: 'A fun summer camp with various activities',
    nullable: true,
  })
  description!: string | null;
  
  /**
   * Start date of the camp session
   */
  @ApiProperty({
    description: 'Start date of the camp',
    example: '2025-06-15T00:00:00.000Z',
  })
  startDate!: Date;
  
  /**
   * End date of the camp session
   */
  @ApiProperty({
    description: 'End date of the camp',
    example: '2025-06-22T00:00:00.000Z',
  })
  endDate!: Date;
  
  /**
   * Location where the camp session will be held
   */
  @ApiProperty({
    description: 'Location where the camp will be held',
    example: 'Mountain View Camp Ground',
  })
  location!: string;
  
  /**
   * Maximum number of participants allowed for the camp
   */
  @ApiProperty({
    description: 'Maximum number of participants',
    example: 100,
  })
  capacity!: number;
  
  /**
   * Indicates whether the camp is active and open for registrations
   */
  @ApiProperty({
    description: 'Whether the camp is currently active',
    example: true,
  })
  isActive!: boolean;
  
  /**
   * Date when the camp was created
   */
  @ApiProperty({
    description: 'When the camp was created',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt!: Date;
  
  /**
   * Date when the camp was last updated
   */
  @ApiProperty({
    description: 'When the camp was last updated',
    example: '2025-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
  
  /**
   * Calculated property showing if the camp is currently in session
   */
  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    return now >= obj.startDate && now <= obj.endDate;
  })
  get isCurrentlyActive(): boolean {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
  }
  
  /**
   * Calculated property showing days remaining until camp starts
   */
  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    if (now >= obj.startDate) return 0;
    const diffTime = obj.startDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })
  get daysUntilStart(): number {
    const now = new Date();
    if (now >= this.startDate) return 0;
    const diffTime = this.startDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  constructor(partial: Partial<Camp>) {
    Object.assign(this, partial);
  }
}