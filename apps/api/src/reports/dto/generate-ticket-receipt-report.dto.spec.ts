import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateTicketReceiptReportDto } from './generate-ticket-receipt-report.dto';

describe('GenerateTicketReceiptReportDto', () => {
  it('shouldDefaultAdditionalBlankRowsToZero', async () => {
    const inputDto = plainToInstance(GenerateTicketReceiptReportDto, {
      title: 'Ticket Receipt Report',
      acknowledgementText: 'I received my ticket.',
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
    expect(inputDto.additionalBlankRows).toBe(0);
  });

  it('shouldRejectAdditionalBlankRowsAboveFifty', async () => {
    const inputDto = plainToInstance(GenerateTicketReceiptReportDto, {
      title: 'Ticket Receipt Report',
      acknowledgementText: 'I received my ticket.',
      additionalBlankRows: 51,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors.some(error => error.property === 'additionalBlankRows')).toBe(true);
  });

  it.each(['year', 'campingOptionId', 'additionalBlankRows'])(
    'shouldRejectNullFor%s',
    async property => {
      const inputDto = plainToInstance(GenerateTicketReceiptReportDto, {
        title: 'Ticket Receipt Report',
        acknowledgementText: 'I received my ticket.',
        [property]: null,
      });

      const actualErrors = await validate(inputDto);

      expect(actualErrors.some(error => error.property === property)).toBe(true);
    }
  );

  it('shouldTrimTextBeforeRejectingWhitespaceOnlySettings', async () => {
    const inputDto = plainToInstance(GenerateTicketReceiptReportDto, {
      title: ' Ticket Receipt Report ',
      acknowledgementText: '   ',
    });

    const actualErrors = await validate(inputDto);

    expect(inputDto.title).toBe('Ticket Receipt Report');
    expect(actualErrors.some(error => error.property === 'acknowledgementText')).toBe(true);
  });
});
