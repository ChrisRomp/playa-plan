import { IsNotEmpty, IsArray, IsOptional, IsObject, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for submitting a registration application.
 * Used when applicationApprovalRequired is enabled in CoreConfig.
 * Only collects camping options and custom fields — jobs, terms, and
 * payment are deferred until after approval.
 */
export class SubmitApplicationDto {
  @ApiProperty({
    description: 'Array of camping option IDs being selected',
    example: ['1d0f7f31-b6d6-4fce-9fe3-dd3d85eb448e'],
    type: [String],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  @IsUUID(4, { each: true })
  campingOptions!: string[];

  @ApiProperty({
    description: 'Custom field values as key-value pairs',
    example: {
      'ef8937b4-70dc-4044-a669-77cfb22dae5e': 750,
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
