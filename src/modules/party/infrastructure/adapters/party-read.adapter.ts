import { IPartyReadPort, PartySnapshot } from '@src/common';
import { Injectable } from '@nestjs/common';
import { IPartyRepository } from '../../domain';

@Injectable()
export class PartyReadAdapter extends IPartyReadPort {
  constructor(private readonly partyRepository: IPartyRepository) {
    super();
  }

  async findById(partyId: string): Promise<PartySnapshot | null> {
    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      return null;
    }

    return {
      id: party.id.value,
      marketId: party.marketId,
      kind: party.person ? 'PERSON' : 'ORGANIZATION',
      personUserId: party.person?.userId.value ?? null,
      organizationOwnerUserId: party.organization?.ownerId.value ?? null,
      providerTier: party.providerRole?.tier ?? null,
    };
  }

  async findPartyIdByUserId(userId: string): Promise<string | null> {
    const party = await this.partyRepository.findByUserId(userId);
    return party ? party.id.value : null;
  }
}
