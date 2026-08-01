import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  AddOrganizationMemberHandler,
  AddProviderRoleHandler,
  AwardBadgeHandler,
  CreateOrganizationPartyHandler,
  CreatePersonPartyHandler,
  DeactivatePartyHandler,
  GetOrgFacingProviderProfileHandler,
  GetPartyByIdHandler,
  GetPublicProviderProfileHandler,
  IPartyRepository,
  IProviderBadgeRepository,
  MonthlyTrustStatsJob,
  OnApplicationAcceptedHandler,
  OnApplicationRejectedHandler,
  PartyMapper,
  PrismaPartyRepository,
  PrismaProviderBadgeRepository,
  ProfileRatingRecalcJob,
  ProviderBadgeMapper,
  ProviderResponseTimeRecalcJob,
  RemoveOrganizationMemberHandler,
  RequestTierUpgradeHandler,
  SearchProvidersByServiceHandler,
  TrustedByCountSyncSaga,
  UpdateProviderRoleHandler,
} from '@module/party';

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue(
      { name: 'party-profile-rating-recalc' },
      { name: 'party-monthly-trust-stats' },
    ),
  ],
  providers: [
    PartyMapper,
    ProviderBadgeMapper,
    {
      provide: IPartyRepository,
      useClass: PrismaPartyRepository,
    },
    {
      provide: IProviderBadgeRepository,
      useClass: PrismaProviderBadgeRepository,
    },
    CreatePersonPartyHandler,
    AddProviderRoleHandler,
    CreateOrganizationPartyHandler,
    AddOrganizationMemberHandler,
    RemoveOrganizationMemberHandler,
    UpdateProviderRoleHandler,
    RequestTierUpgradeHandler,
    DeactivatePartyHandler,
    AwardBadgeHandler,
    GetPartyByIdHandler,
    GetPublicProviderProfileHandler,
    GetOrgFacingProviderProfileHandler,
    SearchProvidersByServiceHandler,
    OnApplicationAcceptedHandler,
    OnApplicationRejectedHandler,
    TrustedByCountSyncSaga,
    ProviderResponseTimeRecalcJob,
    ProfileRatingRecalcJob,
    MonthlyTrustStatsJob,
  ],
})
export class PartyModule {}
