import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyReadPort } from '@src/common';
import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';
import {
  ApplicationId,
  IApplicationRepository,
} from '../../domain';
import {
  SubmitApplicationCommand,
  RequestApplicationAcceptanceCommand,
  RejectApplicationCommand,
  GetApplicationQuery,
  GetApplicationQueryDTO,
} from '../../application';
import {
  ApplicationGraphQLType,
  SubmitApplicationInput,
  RequestApplicationAcceptanceInput,
  ApplicationOperationResultType,
} from '../graphql';

@Resolver(() => ApplicationGraphQLType)
export class ApplicationResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly applicationRepository: IApplicationRepository,
    private readonly partyReadPort: IPartyReadPort,
  ) {}

  @Query(() => [ApplicationGraphQLType], {
    name: 'applicationById',
    description: 'Get an application by ID',
  })
  async applicationById(
    @Args('id') id: string,
  ): Promise<ApplicationGraphQLType[]> {
    const result: GetApplicationQueryDTO = await this.queryBus.execute(
      new GetApplicationQuery({ applicationId: id }),
    );
    return result.applications as ApplicationGraphQLType[];
  }

  @Query(() => [ApplicationGraphQLType], {
    name: 'applicationsByErrand',
    description: 'Get all applications submitted for an errand',
  })
  @UseGuards(GqlAuthGuard)
  async applicationsByErrand(
    @Args('errandId') errandId: string,
  ): Promise<ApplicationGraphQLType[]> {
    const applications = await this.applicationRepository.findByErrandId(
      ErrandId.fromString(errandId),
    );
    return applications.map((app) => ({
      id: app.id.value,
      errandId: app.errandId.value,
      providerPartyId: app.providerPartyId.value,
      proposal: app.proposal(),
      proposedAmountMinorUnits: app.proposedAmountMinorUnits(),
      currency: app.currency(),
      status: app.status(),
      type: app.type(),
      acceptedAt: app.acceptedAt(),
      rejectedAt: app.rejectedAt(),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));
  }

  @Query(() => [ApplicationGraphQLType], {
    name: 'myApplications',
    description: 'Get all applications submitted by the authenticated provider',
  })
  @UseGuards(GqlAuthGuard)
  async myApplications(
    @CurrentUser() user: User,
  ): Promise<ApplicationGraphQLType[]> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      return [];
    }

    const applications = await this.applicationRepository.findByWorkerId(
      PartyId.fromString(partyId),
    );

    return applications.map((app) => ({
      id: app.id.value,
      errandId: app.errandId.value,
      providerPartyId: app.providerPartyId.value,
      proposal: app.proposal(),
      proposedAmountMinorUnits: app.proposedAmountMinorUnits(),
      currency: app.currency(),
      status: app.status(),
      type: app.type(),
      acceptedAt: app.acceptedAt(),
      rejectedAt: app.rejectedAt(),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));
  }

  @Mutation(() => ApplicationOperationResultType, {
    name: 'submitApplication',
    description: 'Submit an application to perform an errand',
  })
  @UseGuards(GqlAuthGuard)
  async submitApplication(
    @Args('input') input: SubmitApplicationInput,
  ): Promise<ApplicationOperationResultType> {
    const result: ApplicationId = await this.commandBus.execute(
      new SubmitApplicationCommand({
        errandId: ErrandId.fromString(input.errandId),
        providerPartyId: PartyId.fromString(input.providerPartyId),
        proposal: input.proposal,
        proposedAmountMinorUnits: input.proposedAmountMinorUnits,
        currency: input.currency,
        applicantType: input.applicantType as any,
      }),
    );
    return {
      id: result.value,
      success: true,
    };
  }

  @Mutation(() => ApplicationOperationResultType, {
    name: 'requestApplicationAcceptance',
    description:
      'Client accepts a worker application, initiating escrow charge flow',
  })
  @UseGuards(GqlAuthGuard)
  async requestApplicationAcceptance(
    @Args('input') input: RequestApplicationAcceptanceInput,
  ): Promise<ApplicationOperationResultType> {
    await this.commandBus.execute(
      new RequestApplicationAcceptanceCommand({
        clientPartyId: PartyId.fromString(input.clientPartyId),
        applicationId: ApplicationId.fromString(input.applicationId),
        paymentMethodId: input.paymentMethodId,
      }),
    );
    return {
      id: input.applicationId,
      success: true,
    };
  }

  @Mutation(() => ApplicationOperationResultType, {
    name: 'rejectApplication',
    description: 'Reject an application for an errand',
  })
  @UseGuards(GqlAuthGuard)
  async rejectApplication(
    @Args('applicationId') applicationId: string,
    @Args('errandId') errandId: string,
  ): Promise<ApplicationOperationResultType> {
    await this.commandBus.execute(
      new RejectApplicationCommand({
        id: ApplicationId.fromString(applicationId),
        errandId: ErrandId.fromString(errandId),
      }),
    );
    return {
      id: applicationId,
      success: true,
    };
  }
}
