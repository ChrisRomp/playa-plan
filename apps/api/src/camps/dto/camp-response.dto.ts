import { Exclude, Expose, Transform } from 'class-transformer';
import { Camp } from '../entities/camp.entity';

/**
 * Data Transfer Object for camp API responses
 */
export class CampResponseDto implements Partial<Camp> {
  /**
   * Unique identifier for the camp
   */
  id: string;
  
  /**
   * Name of the camp session
   */
  name: string;
  
  /**
   * Description of the camp session
   */
  description: string | null;
  
  /**
   * Start date of the camp session
   */
  startDate: Date;
  
  /**
   * End date of the camp session
   */
  endDate: Date;
  
  /**
   * Location where the camp session will be held
   */
  location: string;
  
  /**
   * Maximum number of participants allowed for the camp
   */
  capacity: number;
  
  /**
   * Indicates whether the camp is active and open for registrations
   */
  isActive: boolean;
  
  /**
   * Date when the camp was created
   */
  createdAt: Date;
  
  /**
   * Date when the camp was last updated
   */
  updatedAt: Date;
  
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