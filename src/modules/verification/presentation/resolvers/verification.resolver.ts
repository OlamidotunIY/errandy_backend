import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { GqlAdminGuard, GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyRepository } from '@module/party';
import {
  GetVerificationProfileQuery,
  ReviewVerificationStepCommand,
  SubmitVerificationStepCommand,
} from '../../application';
import {
  ReviewVerificationStepInput,
  SubmitVerificationStepInput,
  VerificationProfileType,
} from '../graphql';

@Resolver(() => VerificationProfileType)
export class VerificationResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly partyRepository: IPartyRepository,
  ) {}

  @Query(() => VerificationProfileType, {
    nullable: true,
    description: 'Get verification profile for authenticated user',
  })
  @UseGuards(GqlAuthGuard)
  async myVerificationProfile(
    @CurrentUser() user: User,
  ): Promise<VerificationProfileType | null> {
    const party = await this.partyRepository.findByUserId(user.id);
    if (!party) {
      throw new NotFoundException('Party profile not found for user');
    }

    return this.queryBus.execute(
      new GetVerificationProfileQuery(party.id.value),
    );
  }

  @Query(() => VerificationProfileType, {
    nullable: true,
    description: 'Get verification profile by partyId (Admin only)',
  })
  @UseGuards(GqlAdminGuard)
  async verificationProfileByPartyId(
    @Args('partyId') partyId: string,
  ): Promise<VerificationProfileType | null> {
    return this.queryBus.execute(new GetVerificationProfileQuery(partyId));
  }

  @Mutation(() => Boolean, {
    description: 'Submit documents for a verification step',
  })
  @UseGuards(GqlAuthGuard)
  async submitVerificationStep(
    @CurrentUser() user: User,
    @Args('input') input: SubmitVerificationStepInput,
  ): Promise<boolean> {
    const party = await this.partyRepository.findByUserId(user.id);
    if (!party) {
      throw new NotFoundException('Party profile not found for user');
    }

    await this.commandBus.execute(
      new SubmitVerificationStepCommand({
        partyId: party.id.value,
        stepType: input.stepType,
        documentUrls: input.documentUrls,
      }),
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Review and approve/reject a verification step (Admin only)',
  })
  @UseGuards(GqlAdminGuard)
  async reviewVerificationStep(
    @CurrentUser() user: User,
    @Args('input') input: ReviewVerificationStepInput,
  ): Promise<boolean> {
    await this.commandBus.execute(
      new ReviewVerificationStepCommand({
        partyId: input.partyId,
        stepType: input.stepType,
        status: input.status,
        reviewerId: user.id,
        rejectionReason: input.rejectionReason,
      }),
    );

    return true;
  }
}
