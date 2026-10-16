import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTrustedCircleQuery } from './get-trusted-circle.query';
import { ITrustedCircleRepository, TrustedCircleProps } from '../../../domain';

@QueryHandler(GetTrustedCircleQuery)
export class GetTrustedCircleHandler
  implements IQueryHandler<GetTrustedCircleQuery, TrustedCircleProps | null>
{
  constructor(
    private readonly trustedCircleRepository: ITrustedCircleRepository,
  ) {}

  async execute(
    query: GetTrustedCircleQuery,
  ): Promise<TrustedCircleProps | null> {
    const circle = await this.trustedCircleRepository.findByOwnerPartyId(
      query.ownerPartyId,
    );
    if (!circle) return null;
    return circle.toPrimitives();
  }
}
