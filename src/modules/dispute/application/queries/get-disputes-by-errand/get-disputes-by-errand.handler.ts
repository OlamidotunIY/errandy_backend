import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetDisputesByErrandQuery } from './get-disputes-by-errand.query';
import { DisputeProps, IDisputeRepository } from '../../../domain';

@QueryHandler(GetDisputesByErrandQuery)
export class GetDisputesByErrandHandler
  implements IQueryHandler<GetDisputesByErrandQuery, DisputeProps[]>
{
  constructor(private readonly disputeRepository: IDisputeRepository) {}

  async execute(query: GetDisputesByErrandQuery): Promise<DisputeProps[]> {
    const disputes = await this.disputeRepository.findByErrandId(
      query.errandId,
    );
    return disputes.map((d) => d.toPrimitives());
  }
}
