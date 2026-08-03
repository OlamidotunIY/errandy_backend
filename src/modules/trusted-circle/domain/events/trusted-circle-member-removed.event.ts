export class TrustedCircleMemberRemovedEvent {
  constructor(
    public readonly payload: {
      partyId: string;
      correlationId?: string;
    },
  ) {}
}
