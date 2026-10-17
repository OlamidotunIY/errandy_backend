import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyReadPort } from '@src/common';
import { IErrandRepository } from '../../domain';
import {
  BrowseOpenErrandsQuery,
  GetErrandByIdQuery,
  CreateErrandCommand,
  PublishErrandCommand,
  StartErrandCommand,
  CompleteErrandCommand,
  ConfirmAssignmentCompletionCommand,
  OfferErrandToTrustedMemberCommand,
  ErrandDetailResponseDto,
  BrowseOpenErrandsResponseDto,
} from '../../application';
import {
  ErrandDetailType,
  BrowseOpenErrandsResponseType,
  BrowseOpenErrandsInput,
  CreateErrandInput,
  ErrandOperationResultType,
  ConfirmAssignmentCompletionType,
  OfferErrandResultType,
} from '../graphql';

@Resolver(() => ErrandDetailType)
export class ErrandsResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly errandRepository: IErrandRepository,
    private readonly partyReadPort: IPartyReadPort,
  ) {}

  @Query(() => ErrandDetailType, {
    name: 'errandById',
    nullable: true,
    description: 'Retrieve errand details by ID',
  })
  async errandById(
    @Args('id') id: string,
  ): Promise<ErrandDetailResponseDto | null> {
    return this.queryBus.execute(new GetErrandByIdQuery({ errandId: id }));
  }

  @Query(() => [ErrandDetailType], {
    name: 'myErrands',
    description: 'Get errands where the authenticated user is client or assigned provider',
  })
  @UseGuards(GqlAuthGuard)
  async myErrands(
    @CurrentUser() user: User,
    @Args('role', { type: () => String, nullable: true, defaultValue: 'CLIENT' })
    role: 'CLIENT' | 'PROVIDER' = 'CLIENT',
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<ErrandDetailResponseDto[]> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      return [];
    }

    const errands =
      role === 'PROVIDER'
        ? await this.errandRepository.findByProviderId(partyId)
        : await this.errandRepository.findByClientId(partyId);

    const filtered = status
      ? errands.filter((e) => e.status.toString() === status)
      : errands;

    return filtered.map((errand) => ({
      id: errand.id.value,
      clientPartyId: errand.clientPartyId,
      categoryId: errand.categoryId,
      title: errand.title,
      description: errand.description,
      addressId: errand.addressId,
      budget: {
        amountMinorUnits: errand.budget.amountMinorUnits,
        currency: errand.budget.currency,
      },
      status: errand.status,
      sourceType: errand.sourceType,
      requiredTier: errand.requiredTier,
      marketId: errand.marketId,
      startedAt: errand.startedAt ? errand.startedAt.toISOString() : undefined,
      completedAt: errand.completedAt
        ? errand.completedAt.toISOString()
        : undefined,
      createdAt: errand.createdAt.toISOString(),
    }));
  }

  @Query(() => BrowseOpenErrandsResponseType, {
    name: 'openErrands',
    description: 'Browse available open errands within a market radius',
  })
  async openErrands(
    @Args('input') input: BrowseOpenErrandsInput,
  ): Promise<BrowseOpenErrandsResponseDto> {
    return this.queryBus.execute(new BrowseOpenErrandsQuery(input));
  }

  @Mutation(() => ErrandOperationResultType, {
    name: 'createErrand',
    description: 'Create a new errand in DRAFT status',
  })
  @UseGuards(GqlAuthGuard)
  async createErrand(
    @Args('input') input: CreateErrandInput,
  ): Promise<ErrandOperationResultType> {
    return this.commandBus.execute(new CreateErrandCommand(input));
  }

  @Mutation(() => ErrandOperationResultType, {
    name: 'publishErrand',
    description: 'Publish a draft errand to the marketplace',
  })
  @UseGuards(GqlAuthGuard)
  async publishErrand(
    @Args('errandId') errandId: string,
  ): Promise<ErrandOperationResultType> {
    return this.commandBus.execute(new PublishErrandCommand({ errandId }));
  }

  @Mutation(() => ErrandOperationResultType, {
    name: 'startErrand',
    description: 'Mark an assigned errand as started/in progress',
  })
  @UseGuards(GqlAuthGuard)
  async startErrand(
    @Args('errandId') errandId: string,
    @Args('providerPartyId') providerPartyId: string,
  ): Promise<ErrandOperationResultType> {
    return this.commandBus.execute(
      new StartErrandCommand({ errandId, providerPartyId }),
    );
  }

  @Mutation(() => ErrandOperationResultType, {
    name: 'completeErrand',
    description: 'Confirm completion of all errand assignments and complete the errand',
  })
  @UseGuards(GqlAuthGuard)
  async completeErrand(
    @Args('errandId') errandId: string,
    @Args('completedBy', { defaultValue: 'CLIENT' })
    completedBy: 'CLIENT' | 'SYSTEM',
  ): Promise<ErrandOperationResultType> {
    return this.commandBus.execute(
      new CompleteErrandCommand({ errandId, completedBy }),
    );
  }

  @Mutation(() => ConfirmAssignmentCompletionType, {
    name: 'confirmAssignmentCompletion',
    description: 'Worker marks their assignment as completed done',
  })
  @UseGuards(GqlAuthGuard)
  async confirmAssignmentCompletion(
    @Args('errandAssignmentId') errandAssignmentId: string,
    @Args('providerPartyId') providerPartyId: string,
    @Args('proofUrl', { nullable: true }) proofUrl?: string,
  ): Promise<ConfirmAssignmentCompletionType> {
    return this.commandBus.execute(
      new ConfirmAssignmentCompletionCommand({
        errandAssignmentId,
        providerPartyId,
        proofUrl,
      }),
    );
  }

  @Mutation(() => OfferErrandResultType, {
    name: 'offerErrandToTrustedMember',
    description: 'Directly offer an errand to a trusted circle member',
  })
  @UseGuards(GqlAuthGuard)
  async offerErrandToTrustedMember(
    @Args('errandId') errandId: string,
    @Args('offeredToPartyId') offeredToPartyId: string,
    @Args('proposedAmountMinorUnits') proposedAmountMinorUnits: number,
    @Args('currency') currency: string,
  ): Promise<OfferErrandResultType> {
    return this.commandBus.execute(
      new OfferErrandToTrustedMemberCommand({
        errandId,
        offeredToPartyId,
        proposedAmountMinorUnits,
        currency,
      }),
    );
  }
}
