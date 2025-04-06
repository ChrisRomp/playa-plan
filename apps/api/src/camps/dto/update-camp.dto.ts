import { IsString, IsOptional, IsInt, IsBoolean, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for updating an existing camp
 */
export class UpdateCampDto {
  /**
   * Name of the camp session
   * @example "Summer Camp 2025"
   */
  @IsString()
  @IsOptional()
  name?: string;

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
  @IsOptional()
  startDate?: string;

  /**
   * End date of the camp session (ISO format)
   * @example "2025-09-01T23:59:59.000Z"
   */
  @IsDateString()
  @IsOptional()
  endDate?: string;

  /**
   * Location where the camp session will be held
   * @example "Black Rock Desert, Nevada"
   */
  @IsString()
  @IsOptional()
  location?: string;

  /**
   * Maximum number of participants allowed for the camp
   * @example 500
   */
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  capacity?: number;

  /**
   * Indicates whether the camp is active and open for registrations
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}