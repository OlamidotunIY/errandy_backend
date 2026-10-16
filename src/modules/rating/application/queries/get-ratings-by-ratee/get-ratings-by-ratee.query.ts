import { Query } from '@nestjs/cqrs';
import { RatingProps } from '../../../domain';

export class GetRatingsByRateeQuery extends Query<RatingProps[]> {
  constructor(
    public readonly rateePartyId: string,
    public readonly limit: number = 20,
  ) {
    super();
  }
}
