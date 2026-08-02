export class TrustedCircleMemberConfirmedEvent {
  constructor(
    public readonly payload: {
      partyId: string;
      correlationId?: string;
    },
  ) {}
}
