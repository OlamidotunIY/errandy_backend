import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IPartyReadPort } from '@src/common';
import {
  AddClientRoleHandler,
  AddOrganizationMemberHandler,
  AddProviderRoleHandler,
  AwardBadgeHandler,
  CreateOrganizationPartyHandler,
  CreatePersonPartyHandler,
  DeactivatePartyHandler,
  GetOrgFacingProviderProfileHandler,
  GetPartyByIdHandler,
  GetPublicProviderProfileHandler,
  MonthlyTrustStatsJob,
  OnAuthUserRegisteredHandler,
  OnVerificationCompletedHandler,
  OnErrandCompletedHandler,
  OnDisputeOpenedHandler,
  OnRatingSubmittedHandler,
  ProfileRatingRecalcJob,
  ProviderResponseTimeRecalcJob,
  RemoveOrganizationMemberHandler,
  RequestTierUpgradeHandler,
  SearchProvidersByServiceHandler,
  SetDefaultPaymentMethodHandler,
  TrustedByCountSyncSaga,
  UpdateProviderRoleHandler,
} from './application';
import { IPartyRepository } from './domain/repositories/party.repository.interface';
import { IProviderBadgeRepository } from './domain/repositories/provider-badge.repository.interface';
import {
  PartyMapper,
  PartyReadAdapter,
  PrismaPartyRepository,
  PrismaProviderBadgeRepository,
  ProviderBadgeMapper,
} from './infrastructure';
import { PartyResolver } from './presentation';

@Global()
@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue(
      { name: 'party-profile-rating-recalc' },
      { name: 'party-monthly-trust-stats' },
    ),
  ],
  providers: [
    PartyResolver,
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
    PartyReadAdapter,
    {
      provide: IPartyReadPort,
      useClass: PartyReadAdapter,
    },
    CreatePersonPartyHandler,
    AddProviderRoleHandler,
    AddClientRoleHandler,
    SetDefaultPaymentMethodHandler,
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
    OnAuthUserRegisteredHandler,
    OnVerificationCompletedHandler,
    OnErrandCompletedHandler,
    OnDisputeOpenedHandler,
    OnRatingSubmittedHandler,
    TrustedByCountSyncSaga,
    ProviderResponseTimeRecalcJob,
    ProfileRatingRecalcJob,
    MonthlyTrustStatsJob,
  ],
  exports: [IPartyReadPort],
})
export class PartyModule {}
