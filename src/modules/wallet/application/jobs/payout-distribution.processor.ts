import {
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { Paystack } from '@paystack/paystack-sdk';
import { ILogger } from '@src/common';
import { PAYMENT_PROVIDER } from '@src/infrastructure/payment-provider';
import { QUEUE_NAMES } from '@src/infrastructure/queue/queue.constants';
import { IBankAccountRepository } from '../../domain/repositories';
import { PayoutDistributionPayload } from './payout-distribution.payload';
import { ReverseWithdrawalCommand } from '../commands/reverse-withdrawal/reverse-withdrawal.command';
import { UserId } from '@module/user/domain';
import { Currency, Money } from '@module/escrow/domain';

@Processor(QUEUE_NAMES.PAYOUT_DISTRIBUTION)
@Injectable()
export class PayoutDistributionProcessor extends WorkerHost {
  constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly paystack: Paystack,
    private readonly bankAccountRepository: IBankAccountRepository,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {
    super();
  }

  async process(job: Job<PayoutDistributionPayload>): Promise<any> {
    const {
      userId,
      bankAccountId,
      amountMinorUnits,
      currency,
      gatewayReference,
      correlationId,
    } = job.data;

    this.logger.info(`Processing payout distribution for ${gatewayReference}`, {
      userId,
      amountMinorUnits,
      currency,
      correlationId,
    });

    const bankAccount = await this.bankAccountRepository.findById(bankAccountId);
    if (!bankAccount) {
      this.logger.error(`Bank account ${bankAccountId} not found for payout`, undefined, {
        userId,
        gatewayReference,
      });
      // Reverse withdrawal if bank account disappeared
      await this.reversePayout(
        userId,
        amountMinorUnits,
        currency,
        gatewayReference,
        'Bank account not found',
        correlationId,
      );
      return;
    }

    try {
      // Step 1: Create or fetch transfer recipient on Paystack
      const recipientRes = await this.paystack.transferrecipient.create({
        type: 'nuban',
        name: bankAccount.accountName || 'Errandy Runner',
        account_number: bankAccount.accountNumber,
        bank_code: bankAccount.bankCode,
        currency: bankAccount.currency || currency || 'NGN',
      });

      if (!recipientRes.status) {
        throw new Error(
          recipientRes.message || 'Failed to create Paystack transfer recipient',
        );
      }

      const recipientData = recipientRes.data as Record<string, unknown>;
      const recipientCode = (recipientData?.recipient_code as string) ?? '';

      if (!recipientCode) {
        throw new Error('No recipient code returned from Paystack');
      }

      // Step 2: Initiate transfer from Paystack balance
      const transferRes = await this.paystack.transfer.initiate({
        source: 'balance',
        amount: amountMinorUnits,
        recipient: recipientCode,
        reason: `Errandy Payout ${gatewayReference}`,
        currency: currency || 'NGN',
        reference: gatewayReference,
      });

      if (!transferRes.status) {
        throw new Error(
          transferRes.message || 'Failed to initiate Paystack transfer',
        );
      }

      const transferData = transferRes.data as Record<string, unknown>;
      this.logger.info(
        `Paystack payout transfer initiated: ${gatewayReference}`,
        {
          transferCode: transferData?.transfer_code,
          status: transferData?.status,
          correlationId,
        },
      );

      return transferRes.data;
    } catch (err: any) {
      this.logger.error(
        `Failed to process Paystack payout: ${err?.message}`,
        err,
        {
          userId,
          gatewayReference,
          correlationId,
        },
      );

      // Reverse debited funds back to runner available balance
      await this.reversePayout(
        userId,
        amountMinorUnits,
        currency,
        gatewayReference,
        err?.message ?? 'Paystack transfer initiation failed',
        correlationId,
      );

      throw err;
    }
  }

  private async reversePayout(
    userId: string,
    amountMinorUnits: number,
    currency: string,
    gatewayReference: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.commandBus.execute(
        new ReverseWithdrawalCommand(
          UserId.fromString(userId),
          Money.fromMinorUnits(amountMinorUnits, currency.toUpperCase() as Currency),
          gatewayReference,
          reason,
          correlationId,
        ),
      );
      this.logger.info(
        `Withdrawal ${gatewayReference} debited funds reversed to available balance`,
      );
    } catch (reverseErr: any) {
      this.logger.error(
        `Failed to reverse withdrawal ${gatewayReference}: ${reverseErr?.message}`,
        reverseErr,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PayoutDistributionPayload>, error: Error) {
    this.logger.error(
      `Payout distribution job permanently failed for ${job.data?.gatewayReference}`,
      error,
      { attemptsMade: job.attemptsMade },
    );
  }
}
