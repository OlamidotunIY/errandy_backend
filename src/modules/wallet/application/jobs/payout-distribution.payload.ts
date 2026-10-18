export interface PayoutDistributionPayload {
  userId: string;
  bankAccountId: string;
  amountMinorUnits: number;
  currency: string;
  gatewayReference: string;
  correlationId: string;
}
