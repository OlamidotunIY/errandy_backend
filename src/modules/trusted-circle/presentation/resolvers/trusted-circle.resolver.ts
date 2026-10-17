import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyReadPort } from '@src/common';
import {
  AddTrustedMemberCommand,
  GetTrustedCircleQuery,
  RemoveTrustedMemberCommand,
} from '../../application';
import { AddTrustedMemberInput, TrustedCircleType } from '../graphql';

@Resolver(() => TrustedCircleType)
@UseGuards(GqlAuthGuard)
export class TrustedCircleResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly partyReadPort: IPartyReadPort,
  ) {}

  @Query(() => TrustedCircleType, {
    nullable: true,
    description: 'Get trusted circle of providers for the authenticated user',
  })
  async myTrustedCircle(
    @CurrentUser() user: User,
  ): Promise<TrustedCircleType | null> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    return this.queryBus.execute(new GetTrustedCircleQuery(partyId));
  }

  @Mutation(() => Boolean, {
    description: 'Add a provider to user trusted circle',
  })
  async addTrustedMember(
    @CurrentUser() user: User,
    @Args('input') input: AddTrustedMemberInput,
  ): Promise<boolean> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    await this.commandBus.execute(
      new AddTrustedMemberCommand({
        ownerPartyId: partyId,
        memberPartyId: input.memberPartyId,
        status: input.status,
        sharedFromPartyId: input.sharedFromPartyId,
      }),
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove a provider from user trusted circle',
  })
  async removeTrustedMember(
    @CurrentUser() user: User,
    @Args('memberPartyId') memberPartyId: string,
  ): Promise<boolean> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    await this.commandBus.execute(
      new RemoveTrustedMemberCommand({
        ownerPartyId: partyId,
        memberPartyId,
      }),
    );

    return true;
  }
}
