import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

export interface ProfileRatingRecalcPayload {
  partyId: string;
  avgRating: number;
}

export class ProfileRatingRecalcJob {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly logger: ILogger,
  ) {}

  async run(payload: ProfileRatingRecalcPayload): Promise<void> {
    const { partyId, avgRating } = payload;

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    party.providerRole.recomputeAvgRating(avgRating);
    await this.partyRepository.save(party);

    this.logger.info('Provider rating recalculated', {
      partyId,
    });
  }
}
