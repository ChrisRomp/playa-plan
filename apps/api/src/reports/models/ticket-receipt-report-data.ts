/** Data required by the ticket-receipt document builder. */
export interface TicketReceiptReportData {
  readonly attendees: ReadonlyArray<{
    readonly name: string;
    readonly workShifts: string;
  }>;
  readonly year: number;
}
