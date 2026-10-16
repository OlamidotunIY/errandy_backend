import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetDisputeByIdQuery } from './get-dispute-by-id.query';
import { DisputeProps, IDisputeRepository } from '../../../domain';

@QueryHandler(GetDisputeByIdQuery)
export class GetDisputeByIdHandler
  implements IQueryHandler<GetDisputeByIdQuery, DisputeProps | null>
{
  constructor(private readonly disputeRepository: IDisputeRepository) {}

  async execute(query: GetDisputeByIdQuery): Promise<DisputeProps | null> {
    const dispute = await this.disputeRepository.findById(query.id);
    if (!dispute) return null;
    return dispute.toPrimitives();
  }
}
