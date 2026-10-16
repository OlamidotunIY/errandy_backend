import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListDisputesQuery } from './list-disputes.query';
import { DisputeProps, IDisputeRepository } from '../../../domain';

@QueryHandler(ListDisputesQuery)
export class ListDisputesHandler
  implements IQueryHandler<ListDisputesQuery, DisputeProps[]>
{
  constructor(private readonly disputeRepository: IDisputeRepository) {}

  async execute(query: ListDisputesQuery): Promise<DisputeProps[]> {
    const disputes = await this.disputeRepository.findAll(
      query.status,
      query.limit,
    );
    return disputes.map((d) => d.toPrimitives());
  }
}
