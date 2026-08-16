import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { TICKET_RECEIPT_REPORT_CONSTRAINTS } from '../constants/ticket-receipt-report.constants';
import { MaxLineCount } from '../validators/max-line-count.validator';
import { TicketReceiptSettingsDto } from './ticket-receipt-settings.dto';

/** Validated options for generating a ticket-receipt signature form. */
export class GenerateTicketReceiptReportDto extends TicketReceiptSettingsDto {
  @ApiProperty({
    description: 'Acknowledgement printed in every signature row',
    example: 'I acknowledge receipt of my event ticket.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  @MaxLineCount(TICKET_RECEIPT_REPORT_CONSTRAINTS.acknowledgementMaximumLines, {
    message: `Acknowledgement must be ${TICKET_RECEIPT_REPORT_CONSTRAINTS.acknowledgementMaximumLines} lines or fewer`,
  })
  acknowledgementText!: string;

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
