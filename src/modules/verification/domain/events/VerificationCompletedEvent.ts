import { ProviderTier } from '@module/party';

export class VerificationCompletedEvent {
  constructor(
    public readonly payload: {
      partyId: string;
      tier: ProviderTier;
      correlationId?: string;
    },
  ) {}
}
