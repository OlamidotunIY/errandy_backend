import {
  GetLedgerHistoryQuery,
  GetWalletBalancesQuery,
  LedgerHistoryPageDTO,
  LedgerHistoryPageType,
  WalletBalancesType,
} from '@module/wallet';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@src/auth/decorator/current-user.decorator';
import { User } from 'better-auth';
import { UserId } from '@module/user';

@Resolver()
class WalletResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @Query(() => WalletBalancesType)
  async walletBalances(@CurrentUser() user: User): Promise<WalletBalancesType> {
    return this.queryBus.execute(
      new GetWalletBalancesQuery(UserId.fromString(user.id)),
    );
  }

  @Query(() => LedgerHistoryPageType)
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
}

export { WalletResolver };
