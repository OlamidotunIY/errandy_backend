import { Args, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { EscrowGraphQLType } from '../graphql';
import { CurrentUser } from '../../../../auth/decorator/current-user.decorator';
import { User } from '@user/entities/user.entity';
import { GetEscrowByErrandQuery } from 'src/modules/escrow/application';
import { ErrandId } from '@errands';

@Resolver()
export class EscrowResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @Query(() => EscrowGraphQLType)
  async escrowById(
    @CurrentUser() user: User,
    @Args('errandId') id: string,
  ): Promise<EscrowGraphQLType> {
    return (await this.queryBus.execute(
      new GetEscrowByErrandQuery({
        errandId: ErrandId.fromString(id),
      }),
    )) as EscrowGraphQLType;
  }
}
