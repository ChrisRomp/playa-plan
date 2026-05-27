import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { RegistrationStatus } from '@prisma/client';

const BULK_APPLICATION_ACTIONS = ['approve', 'decline'] as const;
const APPLICATION_QUERY_STATUSES = [
  RegistrationStatus.APPLICATION_SUBMITTED,
  RegistrationStatus.APPLICATION_APPROVED,
  RegistrationStatus.APPLICATION_DECLINED,
] as const;

export type BulkApplicationAction = (typeof BULK_APPLICATION_ACTIONS)[number];
export type ApplicationQueryStatus = (typeof APPLICATION_QUERY_STATUSES)[number];

/** DTO for approving an application. */
export class ApproveApplicationDto {
  @ApiPropertyOptional({ description: 'Optional message to include in approval notification' })
  @IsOptional()
  @IsString()
  message?: string;
}

/** DTO for declining an application. */
export class DeclineApplicationDto {
  @ApiProperty({ description: 'Required message explaining the decision (sent to applicant)' })
  @IsNotEmpty()
  @IsString()
  message!: string;
}

/** DTO for bulk application approval/decline actions. */
export class BulkApplicationActionDto {
  @ApiProperty({ description: 'Application (registration) IDs to process', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  ids!: string[];

  @ApiProperty({ description: 'Action to perform', enum: BULK_APPLICATION_ACTIONS })
  @IsIn(BULK_APPLICATION_ACTIONS)
  action!: BulkApplicationAction;

  @ApiPropertyOptional({ description: 'Message (required for decline)' })
  @IsOptional()
  @IsString()
  message?: string;
}

/** DTO for application management list filters. */
export class ApplicationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: APPLICATION_QUERY_STATUSES,
  })
  @IsOptional()
  @IsIn(APPLICATION_QUERY_STATUSES)
  status?: ApplicationQueryStatus;

  @ApiPropertyOptional({ description: 'Filter by year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ description: 'Search by user name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
