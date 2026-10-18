import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQuery } from './get-application.query';
import { GetApplicationQueryDTO } from './get-application.query.dto';
import { ApplicationId, IApplicationRepository } from '../../../domain';

@QueryHandler(GetApplicationQuery)
export class GetApplicationHandler implements IQueryHandler<GetApplicationQuery> {
  constructor(public readonly repository: IApplicationRepository) {}

  async execute(query: GetApplicationQuery): Promise<GetApplicationQueryDTO> {
    const application = await this.repository.findById(
      ApplicationId.fromString(query.payload.applicationId),
    );

    if (!application) {
      return { applications: [], nextCursor: null };
    }

    return {
      applications: [
        {
          id: application.id.value,
          errandId: application.errandId.value,
          providerPartyId: application.providerPartyId.value,
          status: application.status(),
          type: application.type(),
          proposal: application.proposal(),
          proposedAmountMinorUnits: application.proposedAmountMinorUnits(),
          currency: application.currency(),
          acceptedAt: application.acceptedAt(),
          rejectedAt: application.rejectedAt(),
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
      ],
      nextCursor: null,
    };
  }
}
