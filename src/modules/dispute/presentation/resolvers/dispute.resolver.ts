import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { GqlAdminGuard, GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyReadPort } from '@src/common';
import {
  GetDisputeByIdQuery,
  GetDisputesByErrandQuery,
  ListDisputesQuery,
  OpenDisputeCommand,
  ResolveDisputeCommand,
} from '../../application';
import { DisputeStatus, IDisputeRepository } from '../../domain';
import {
  DisputeType,
  OpenDisputeInput,
  ResolveDisputeInput,
} from '../graphql';

@Resolver(() => DisputeType)
export class DisputeResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly partyReadPort: IPartyReadPort,
    private readonly disputeRepository: IDisputeRepository,
  ) {}

  @Query(() => DisputeType, {
    nullable: true,
    description: 'Get dispute details by dispute ID',
  })
  @UseGuards(GqlAuthGuard)
  async disputeById(@Args('id') id: string): Promise<DisputeType | null> {
    return this.queryBus.execute(new GetDisputeByIdQuery(id));
  }

  @Query(() => [DisputeType], {
    description: 'Get disputes for an errand',
  })
  @UseGuards(GqlAuthGuard)
  async disputesByErrand(
    @Args('errandId') errandId: string,
  ): Promise<DisputeType[]> {
    return this.queryBus.execute(new GetDisputesByErrandQuery(errandId));
  }

  @Query(() => [DisputeType], {
    description: 'Get disputes raised by current user',
  })
  @UseGuards(GqlAuthGuard)
  async myDisputes(@CurrentUser() user: User): Promise<DisputeType[]> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    const disputes = await this.disputeRepository.findByRaisedById(partyId);
    return disputes.map((d) => d.toPrimitives());
  }

  @Query(() => [DisputeType], {
    description: 'List disputes with optional status filter (Admin only)',
  })
  @UseGuards(GqlAdminGuard)
  async allDisputes(
    @Args('status', { nullable: true }) status?: string,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit?: number,
  ): Promise<DisputeType[]> {
    return this.queryBus.execute(
      new ListDisputesQuery(status as DisputeStatus, limit),
    );
  }

  @Mutation(() => String, {
    description: 'Open a formal dispute on an errand',
  })
  @UseGuards(GqlAuthGuard)
  async openDispute(
    @CurrentUser() user: User,
    @Args('input') input: OpenDisputeInput,
  ): Promise<string> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    return this.commandBus.execute(
      new OpenDisputeCommand({
        errandId: input.errandId,
        raisedById: partyId,
        providerPartyId: input.providerPartyId,
        reason: input.reason,
        description: input.description,
        evidenceUrls: input.evidenceUrls,
      }),
    );
  }

  @Mutation(() => Boolean, {
    description: 'Resolve or reject a dispute (Admin only)',
  })
  @UseGuards(GqlAdminGuard)
  async resolveDispute(
    @CurrentUser() user: User,
    @Args('input') input: ResolveDisputeInput,
  ): Promise<boolean> {
    await this.commandBus.execute(
      new ResolveDisputeCommand({
        disputeId: input.disputeId,
        status: input.status,
        resolution: input.resolution,
        adminUserId: user.id,
      }),
    );

    return true;
  }
}
