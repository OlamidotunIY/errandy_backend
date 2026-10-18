import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReplyToRatingCommand } from './reply-to-rating.command';
import { IRatingRepository, RatingReplyProps } from '../../../domain';

@CommandHandler(ReplyToRatingCommand)
export class ReplyToRatingHandler
  implements ICommandHandler<ReplyToRatingCommand, RatingReplyProps>
{
  constructor(private readonly ratingRepository: IRatingRepository) {}

  async execute(command: ReplyToRatingCommand): Promise<RatingReplyProps> {
    const { ratingId, userId, content } = command.payload;
    return this.ratingRepository.addReply(ratingId, userId, content);
  }
}
