import { Query } from '@nestjs/cqrs';
import { RatingProps } from '../../../domain';

export class GetRatingsByErrandQuery extends Query<RatingProps[]> {
  constructor(public readonly errandId: string) {
    super();
  }
}
