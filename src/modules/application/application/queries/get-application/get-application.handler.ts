import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQuery, GetApplicationQueryDTO } from './';
import { IApplicationRepository } from '@src/modules';
import { ApplicationId } from '@module/application';

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
