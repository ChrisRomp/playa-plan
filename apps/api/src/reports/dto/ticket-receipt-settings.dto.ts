import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { TICKET_RECEIPT_REPORT_CONSTRAINTS } from '../constants/ticket-receipt-report.constants';
import { MaxLineCount } from '../validators/max-line-count.validator';

/** Shared defaults persisted for the ticket-receipt report. */
export class TicketReceiptSettingsDto {
  @ApiProperty({
    description: 'Title printed at the top of the report',
    example: 'Ticket Receipt Report',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  title!: string;

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
}
