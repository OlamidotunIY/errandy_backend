import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPartyByIdQuery } from './get-party-by-id.query';
import { GetPartyByIdResponseDto } from './get-party-by-id.request.dto';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '../../../domain';

@QueryHandler(GetPartyByIdQuery)
export class GetPartyByIdHandler implements IQueryHandler<GetPartyByIdQuery> {
  constructor(private readonly partyRepository: IPartyRepository) {}

  async execute(query: GetPartyByIdQuery): Promise<GetPartyByIdResponseDto> {
    const { partyId } = query.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    return {
      id: party.id.value,
      kind: party.kind,
      marketId: party.marketId,
      isActive: party.isActive,
      personUserId: party.person?.userId.value,
      organizationName: party.organization?.name,
      providerTier: party.providerRole?.tier,
    };
  }
}
