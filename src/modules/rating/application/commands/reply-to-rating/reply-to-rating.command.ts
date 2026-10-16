import { Command } from '@nestjs/cqrs';
import { RatingReplyProps } from '../../../domain';

export interface ReplyToRatingDto {
  ratingId: string;
  userId: string;
  content: string;
}

export class ReplyToRatingCommand extends Command<RatingReplyProps> {
  constructor(public readonly payload: ReplyToRatingDto) {
    super();
  }
}
