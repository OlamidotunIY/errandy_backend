import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

export interface ProviderResponseTimeRecalcPayload {
  partyId: string;
  avgResponseTimeSeconds: number;
}

export class ProviderResponseTimeRecalcJob {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly logger: ILogger,
  ) {}

  async run(payload: ProviderResponseTimeRecalcPayload): Promise<void> {
    const { partyId, avgResponseTimeSeconds } = payload;

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    party.providerRole.setAverageResponseTimeSeconds(avgResponseTimeSeconds);
    await this.partyRepository.save(party);

    this.logger.info('Provider response time recalculated', {
      partyId,
    });
  }
}
