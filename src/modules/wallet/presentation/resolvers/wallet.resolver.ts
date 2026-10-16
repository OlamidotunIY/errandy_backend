import {
  GetLedgerHistoryQuery,
  GetWalletBalancesQuery,
  LedgerHistoryPageDTO,
  LedgerHistoryPageType,
  WalletBalancesType,
  RecordWithdrawalCommand,
  IBankAccountRepository,
  BankAccountType,
  AddBankAccountInput,
  RequestWithdrawalInput,
  WithdrawalResultType,
} from '@module/wallet';
import { Currency, Money } from '@module/escrow';
import { UserId } from '@module/user';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@src/infrastructure/queue/queue.constants';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { randomUUID } from 'crypto';
import { PayoutDistributionPayload } from '../../application/jobs';

@Resolver()
@UseGuards(GqlAuthGuard)
export class WalletResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly bankAccountRepository: IBankAccountRepository,
    @InjectQueue(QUEUE_NAMES.PAYOUT_DISTRIBUTION)
    private readonly payoutQueue: Queue<PayoutDistributionPayload>,
  ) {}

  @Query(() => WalletBalancesType, {
    description: 'Get current wallet balances across active, pending, and available buckets',
  })
  async walletBalances(@CurrentUser() user: User): Promise<WalletBalancesType> {
    return this.queryBus.execute(
      new GetWalletBalancesQuery(UserId.fromString(user.id)),
    );
  }

  @Query(() => LedgerHistoryPageType, {
    description: 'Get paginated audit ledger history for user wallet',
  })
  async ledgerHistory(
    @CurrentUser() user: User,
    @Args('cursor', { nullable: true }) cursor?: string,
    @Args('limit', { defaultValue: 20 }) limit?: number,
  ): Promise<LedgerHistoryPageDTO> {
    return this.queryBus.execute(
      new GetLedgerHistoryQuery(
        UserId.fromString(user.id),
        cursor ?? null,
        limit as number,
      ),
    );
  }

  @Query(() => [BankAccountType], {
    description: 'Get all saved bank accounts for the authenticated user',
  })
  async myBankAccounts(@CurrentUser() user: User): Promise<BankAccountType[]> {
    return this.bankAccountRepository.findByOwnerId(user.id);
  }

  @Query(() => BankAccountType, {
    nullable: true,
    description: 'Get default bank account for the authenticated user',
  })
  async defaultBankAccount(
    @CurrentUser() user: User,
  ): Promise<BankAccountType | null> {
    return this.bankAccountRepository.findDefaultByOwnerId(user.id);
  }

  @Mutation(() => BankAccountType, {
    description: 'Add a new bank account for payout / withdrawal',
  })
  async addBankAccount(
    @CurrentUser() user: User,
    @Args('input') input: AddBankAccountInput,
  ): Promise<BankAccountType> {
    const existing = await this.bankAccountRepository.findByOwnerId(user.id);
    const shouldBeDefault = input.isDefault || existing.length === 0;

    if (shouldBeDefault && existing.length > 0) {
      for (const acc of existing) {
        if (acc.isDefault) {
          await this.bankAccountRepository.save({
            ...acc,
            isDefault: false,
          });
        }
      }
    }

    return this.bankAccountRepository.save({
      id: randomUUID(),
      ownerId: user.id,
      currency: input.currency || 'NGN',
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName ?? null,
      isVerified: false,
      isDefault: shouldBeDefault,
    });
  }

  @Mutation(() => BankAccountType, {
    description: 'Set a bank account as default',
  })
  async setDefaultBankAccount(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<BankAccountType> {
    const account = await this.bankAccountRepository.findById(id);
    if (!account || account.ownerId !== user.id) {
      throw new NotFoundException('Bank account not found or access denied');
    }

    const existing = await this.bankAccountRepository.findByOwnerId(user.id);
    for (const acc of existing) {
      if (acc.isDefault && acc.id !== id) {
        await this.bankAccountRepository.save({
          ...acc,
          isDefault: false,
        });
      }
    }

    return this.bankAccountRepository.save({
      ...account,
      isDefault: true,
    });
  }

  @Mutation(() => Boolean, {
    description: 'Delete a saved bank account',
  })
  async deleteBankAccount(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    const account = await this.bankAccountRepository.findById(id);
    if (!account || account.ownerId !== user.id) {
      throw new NotFoundException('Bank account not found or access denied');
    }

    await this.bankAccountRepository.delete(id);
    return true;
  }

  @Mutation(() => WithdrawalResultType, {
    description: 'Request a withdrawal from available wallet balance',
  })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Args('input') input: RequestWithdrawalInput,
  ): Promise<WithdrawalResultType> {
    const bankAccount = await this.bankAccountRepository.findById(
      input.bankAccountId,
    );
    if (!bankAccount || bankAccount.ownerId !== user.id) {
      throw new NotFoundException('Bank account not found or access denied');
    }

    const gatewayReference = `wd_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const currency = (input.currency ?? 'NGN').toUpperCase() as Currency;

    const correlationId = randomUUID();

    await this.commandBus.execute(
      new RecordWithdrawalCommand(
        UserId.fromString(user.id),
        Money.fromMinorUnits(input.amountMinorUnits, currency),
        currency,
        gatewayReference,
        correlationId,
      ),
    );

    await this.payoutQueue.add('payout-distribution', {
      userId: user.id,
      bankAccountId: input.bankAccountId,
      amountMinorUnits: input.amountMinorUnits,
      currency,
      gatewayReference,
      correlationId,
    });

    return {
      success: true,
      message: 'Withdrawal recorded and payout queued successfully',
      gatewayReference,
    };
  }
}
