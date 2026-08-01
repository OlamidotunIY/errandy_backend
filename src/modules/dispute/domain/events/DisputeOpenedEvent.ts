export class DisputeOpenedEvent {
  constructor(
    public readonly payload: {
      partyId: string;
      correlationId?: string;
    },
  ) {}
}
