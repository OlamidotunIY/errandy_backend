export class RatingSubmittedEvent {
  constructor(
    public readonly payload: {
      partyId: string;
      rating: number;
      source?: 'CLIENT_FACING' | 'ORG_FACING';
      correlationId?: string;
    },
  ) {}
}
