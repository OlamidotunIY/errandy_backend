/**
 * Integration events published by ErrandsModule when an errand is offered or
 * directly assigned to a trusted circle member.
 * ApplicationModule listens to these to create the Application aggregate root.
 */
export class ErrandOfferedToTrustedMemberIntegrationEvent {
  constructor(
    public readonly payload: {
      applicationId: string;
      errandId: string;
      offeredToPartyId: string;
      proposedAmountMinorUnits: number;
      currency: string;
      originType: 'DIRECT_OFFER';
    },
  ) {}
}

export class ErrandDirectlyAssignedIntegrationEvent {
  constructor(
    public readonly payload: {
      applicationId: string;
      errandId: string;
      offeredToPartyId: string;
      proposedAmountMinorUnits: number;
      currency: string;
    },
  ) {}
}
