/**
 * Represents a camp session in the PlayaPlan system.
 * Camps are the main organizational unit for events, with defined dates and location.
 */
export class Camp {
  /**
   * Unique identifier for the camp
   */
  id: string;
  
  /**
   * Name of the camp session
   */
  name: string;
  
  /**
   * Optional description of the camp session
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
   * Date when the camp record was created
   */
  createdAt: Date;
  
  /**
   * Date when the camp record was last updated
   */
  updatedAt: Date;
}