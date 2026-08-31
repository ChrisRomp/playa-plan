import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const UNVERIFIED_USER_CLEANUP_BATCH_LIMIT = 100;

/** Query parameters for listing stale unverified participant accounts. */
export class UnverifiedUserCleanupQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: UNVERIFIED_USER_CLEANUP_BATCH_LIMIT,
    maximum: UNVERIFIED_USER_CLEANUP_BATCH_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(UNVERIFIED_USER_CLEANUP_BATCH_LIMIT)
  readonly limit: number = UNVERIFIED_USER_CLEANUP_BATCH_LIMIT;
}

/** Selected user IDs for permanent unverified-account cleanup. */
export class DeleteUnverifiedUsersDto {
  @ApiProperty({
    description: 'Eligible participant user IDs to permanently delete',
    type: [String],
    maxItems: UNVERIFIED_USER_CLEANUP_BATCH_LIMIT,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(UNVERIFIED_USER_CLEANUP_BATCH_LIMIT)
  @ArrayUnique()
  @IsUUID(4, { each: true })
  readonly ids!: string[];
}
