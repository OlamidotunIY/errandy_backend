import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

export interface MonthlyTrustStatsPayload {
  partyId: string;
  delta: number;
}

export class MonthlyTrustStatsJob {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly logger: ILogger,
  ) {}

  async run(payload: MonthlyTrustStatsPayload): Promise<void> {
    const { partyId, delta } = payload;

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        party.providerRole.incrementTrustedByCount();
      }
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) {
        party.providerRole.decrementTrustedByCount();
      }
    } else {
      this.logger.warn('Monthly trust stats delta is zero', { partyId });
    }

    await this.partyRepository.save(party);

    this.logger.info('Monthly trust stats synced', {
      partyId,
      delta,
    });
  }
}
