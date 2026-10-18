import {
  AddOrganizationMemberCommand,
  AddProviderRoleCommand,
  AwardBadgeCommand,
  GetOrgFacingProviderProfileQuery,
  GetPublicProviderProfileQuery,
  RemoveOrganizationMemberCommand,
  RequestTierUpgradeCommand,
  SearchProvidersByServiceQuery,
  UpdateProviderRoleCommand,
} from '../../application';
import { IPartyRepository, ProviderTier } from '../../domain';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import {
  AddOrganizationMemberInput,
  AddOrganizationMemberType,
  AddProviderRoleType,
  AwardBadgeInput,
  AwardBadgeType,
  MyPartyProfileType,
  OrgFacingProviderProfileType,
  PublicProviderProfileType,
  RemoveOrganizationMemberType,
  RequestTierUpgradeType,
  SearchProvidersByServiceType,
  UpdateProviderRoleInput,
  UpdateProviderRoleType,
} from '../graphql';

@Resolver()
export class PartyResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly partyRepository: IPartyRepository,
  ) {}

  @Query(() => MyPartyProfileType, {
    nullable: true,
    description: 'Get party profile for the authenticated user',
  })
  @UseGuards(GqlAuthGuard)
  async myPartyProfile(
    @CurrentUser() user: User,
  ): Promise<MyPartyProfileType | null> {
    const party = await this.partyRepository.findByUserId(user.id);
    if (!party) {
      return null;
    }

    return {
      partyId: party.id.value,
      userId: user.id,
      marketId: party.marketId,
      kind: party.person ? 'PERSON' : 'ORGANIZATION',
      hasClientRole: !!party.clientRole,
      hasProviderRole: !!party.providerRole,
      providerTier: party.providerRole?.tier,
      skills: party.providerRole?.skills ?? [],
      bio: party.providerRole?.bio ?? undefined,
    };
  }

  @Mutation(() => AddProviderRoleType)
  async addProviderRole(
    @Args('partyId') partyId: string,
  ): Promise<AddProviderRoleType> {
    return this.commandBus.execute(new AddProviderRoleCommand({ partyId }));
  }

  @Mutation(() => UpdateProviderRoleType)
  async updateProviderRole(
    @Args('partyId') partyId: string,
    @Args('input') input: UpdateProviderRoleInput,
  ): Promise<UpdateProviderRoleType> {
    return this.commandBus.execute(
      new UpdateProviderRoleCommand({ ...input, partyId }),
    );
  }

  @Mutation(() => RequestTierUpgradeType)
  async requestTierUpgrade(
    @Args('partyId') partyId: string,
    @Args('targetTier', { type: () => ProviderTier }) targetTier: ProviderTier,
  ): Promise<RequestTierUpgradeType> {
    return this.commandBus.execute(
      new RequestTierUpgradeCommand({ partyId, targetTier }),
    );
  }

  @Mutation(() => AddOrganizationMemberType)
  async addOrganizationMember(
    @Args('input') input: AddOrganizationMemberInput,
  ): Promise<AddOrganizationMemberType> {
    return this.commandBus.execute(new AddOrganizationMemberCommand(input));
  }

  @Mutation(() => RemoveOrganizationMemberType)
  async removeOrganizationMember(
    @Args('organizationPartyId') organizationPartyId: string,
    @Args('userId') userId: string,
  ): Promise<RemoveOrganizationMemberType> {
    return this.commandBus.execute(
      new RemoveOrganizationMemberCommand({ organizationPartyId, userId }),
    );
  }

  @Mutation(() => AwardBadgeType)
  async awardBadge(
    @Args('input') input: AwardBadgeInput,
  ): Promise<AwardBadgeType> {
    return this.commandBus.execute(new AwardBadgeCommand(input));
  }

  @Query(() => PublicProviderProfileType)
  async publicProviderProfile(
    @Args('partyId') partyId: string,
  ): Promise<PublicProviderProfileType> {
    return this.queryBus.execute(
      new GetPublicProviderProfileQuery({ partyId }),
    );
  }

  @Query(() => OrgFacingProviderProfileType)
  async orgFacingProviderProfile(
    @Args('partyId') partyId: string,
    @Args('requestingOrganizationId') requestingOrganizationId: string,
  ): Promise<OrgFacingProviderProfileType> {
    return this.queryBus.execute(
      new GetOrgFacingProviderProfileQuery({
        partyId,
        requestingOrganizationId,
      }),
    );
  }

  @Query(() => SearchProvidersByServiceType)
  async searchProvidersByService(
    @Args('service') service: string,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<SearchProvidersByServiceType> {
    return this.queryBus.execute(
      new SearchProvidersByServiceQuery({ service, limit }),
    );
  }
}
