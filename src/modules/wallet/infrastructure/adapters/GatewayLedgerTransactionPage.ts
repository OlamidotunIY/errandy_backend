export interface GatewayLedgerTransaction {
  reference: string;
  amount: Money;
}

export interface GatewayLedgerTransactionPage {
  transactions: GatewayLedgerTransaction[];
  nextCursor: string | null;
}
