import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  LedgerHistoryPageType,
  WalletBalancesType,
} from '@wallet/presentation';
import { CurrentUser } from '../../../auth/decorator/current-user.decorator';
import { User } from '@user/entities/user.entity';
import {
  GetLedgerHistoryQuery,
  GetWalletBalancesQuery,
  LedgerHistoryPageDTO,
} from '@wallet/application';
import { UserId } from '@user';

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
