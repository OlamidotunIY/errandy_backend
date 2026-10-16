import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetRatingsByRateeQuery } from './get-ratings-by-ratee.query';
import { IRatingRepository, RatingProps } from '../../../domain';

@QueryHandler(GetRatingsByRateeQuery)
export class GetRatingsByRateeHandler
  implements IQueryHandler<GetRatingsByRateeQuery, RatingProps[]>
{
  constructor(private readonly ratingRepository: IRatingRepository) {}

  async execute(query: GetRatingsByRateeQuery): Promise<RatingProps[]> {
    const ratings = await this.ratingRepository.findByRateeId(
      query.rateePartyId,
      query.limit,
    );
    return ratings.map((r) => r.toPrimitives());
  }
}
