import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsDateString, Min, MaxDate, MinDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for creating a new camp
 */
export class CreateCampDto {
  /**
   * Name of the camp session
   * @example "Summer Camp 2025"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Optional description of the camp session
   * @example "Annual summer camp at Black Rock Desert"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Start date of the camp session (ISO format)
   * @example "2025-08-24T00:00:00.000Z"
   */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /**
   * End date of the camp session (ISO format)
   * @example "2025-09-01T23:59:59.000Z"
   */
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  /**
   * Location where the camp session will be held
   * @example "Black Rock Desert, Nevada"
   */
  @IsString()
  @IsNotEmpty()
  location: string;

  /**
   * Maximum number of participants allowed for the camp
   * @example 500
   */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number;

  /**
   * Indicates whether the camp is active and open for registrations
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}