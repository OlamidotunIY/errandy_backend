import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetRatingsByErrandQuery } from './get-ratings-by-errand.query';
import { IRatingRepository, RatingProps } from '../../../domain';

@QueryHandler(GetRatingsByErrandQuery)
export class GetRatingsByErrandHandler
  implements IQueryHandler<GetRatingsByErrandQuery, RatingProps[]>
{
  constructor(private readonly ratingRepository: IRatingRepository) {}

  async execute(query: GetRatingsByErrandQuery): Promise<RatingProps[]> {
    const ratings = await this.ratingRepository.findByErrandId(query.errandId);
    return ratings.map((r) => r.toPrimitives());
  }
}
