import { Command } from '@nestjs/cqrs';
import { RatingReactionProps } from '../../../domain';

export interface ReactToRatingDto {
  ratingId: string;
  userId: string;
  emoji: string;
}

export class ReactToRatingCommand extends Command<RatingReactionProps> {
  constructor(public readonly payload: ReactToRatingDto) {
    super();
  }
}
