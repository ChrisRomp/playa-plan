import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { TicketReceiptSettingsDto } from './ticket-receipt-settings.dto';

/** Validated options for generating a ticket-receipt signature form. */
export class GenerateTicketReceiptReportDto extends TicketReceiptSettingsDto {
  @ApiPropertyOptional({
    description: 'Registration year; defaults to the configured current year',
    example: 2026,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: 'Camping option to include; omit to include all options',
    format: 'uuid',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  campingOptionId?: string;

  @ApiPropertyOptional({
    description: 'Blank fill-in rows appended for manual registrations',
    default: 0,
    minimum: 0,
    maximum: 50,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  additionalBlankRows = 0;
}
