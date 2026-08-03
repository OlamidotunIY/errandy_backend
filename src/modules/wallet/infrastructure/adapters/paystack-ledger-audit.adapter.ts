import { Inject, Injectable } from '@nestjs/common';
import {
  GatewayLedgerTransaction,
  GatewayLedgerTransactionPage,
} from '@module/wallet';
import { Currency, Money } from '@module/escrow';
import { Paystack } from '@paystack/paystack-sdk';
import { ILogger, PaystackTransactionType } from '@src/common';
import { PAYMENT_PROVIDER } from '@src/infrastructure/payment-provider';

@Injectable()
export class PaystackLedgerAuditAdapter {
  constructor(
    private readonly logger: ILogger,
    @Inject(PAYMENT_PROVIDER)
    private readonly paystack: Paystack,
  ) {}

  async fetchTransactions(
    windowStart: Date,
    windowEnd: Date,
    cursor: string | null,
  ): Promise<GatewayLedgerTransactionPage> {
    const page = cursor ? parseInt(cursor, 10) : 1;

    const response = (await this.paystack.transaction.list({
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
      perPage: 100,
      page,
      status: 'success',
    })) as PaystackTransactionType;

    const transactions: GatewayLedgerTransaction[] = response.data.map(
      (tx) => ({
        reference: tx.reference,
        amount: Money.fromMinorUnits(
          tx.amount,
          ((tx.currency ?? 'NGN').toUpperCase() as Currency) || 'NGN',
        ),
      }),
    );

    return {
      transactions,
      nextCursor: response.meta.next,
    };
  }
}
