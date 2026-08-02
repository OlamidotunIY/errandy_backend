import {
  AddOrganizationMemberCommand,
  AddProviderRoleCommand,
  AwardBadgeCommand,
  GetOrgFacingProviderProfileQuery,
  GetPublicProviderProfileQuery,
  ProviderTier,
  RemoveOrganizationMemberCommand,
  RequestTierUpgradeCommand,
  SearchProvidersByServiceQuery,
  UpdateProviderRoleCommand,
} from '@module/party';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AddOrganizationMemberInput,
  AddOrganizationMemberType,
  AddProviderRoleType,
  AwardBadgeInput,
  AwardBadgeType,
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
  ) {}

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
