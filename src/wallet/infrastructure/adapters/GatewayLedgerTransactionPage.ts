import { PaystackTransactionType } from '@shared';

export interface GatewayLedgerTransaction {
  reference: string;
  amountKobo: number;
}

export interface GatewayLedgerTransactionPage {
  transactions: GatewayLedgerTransaction[];
  nextCursor: string | null;
}
