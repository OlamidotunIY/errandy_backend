import { Args, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { EscrowGraphQLType } from '../graphql';
import { CurrentUser } from '../../../../auth/decorator/current-user.decorator';
import { GetEscrowByErrandQuery } from '@module/escrow';
import { ErrandId } from '@module/errand';

@Resolver()
export class EscrowResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @Query(() => EscrowGraphQLType)
  async escrowById(
    @CurrentUser() _user: unknown,
    @Args('errandId') id: string,
  ): Promise<EscrowGraphQLType> {
    return (await this.queryBus.execute(
      new GetEscrowByErrandQuery({
        errandId: ErrandId.fromString(id),
      }),
    )) as EscrowGraphQLType;
  }
}
