export interface ReconcileLedgerPayload {
  windowStart: Date;
  windowEnd: Date;
  provider: 'paystack' | 'webhook-log';
  cursor: string | null;
  correlationId: string;
}
