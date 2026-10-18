import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReactToRatingCommand } from './react-to-rating.command';
import { IRatingRepository, RatingReactionProps } from '../../../domain';

@CommandHandler(ReactToRatingCommand)
export class ReactToRatingHandler
  implements ICommandHandler<ReactToRatingCommand, RatingReactionProps>
{
  constructor(private readonly ratingRepository: IRatingRepository) {}

  async execute(command: ReactToRatingCommand): Promise<RatingReactionProps> {
    const { ratingId, userId, emoji } = command.payload;
    return this.ratingRepository.addReaction(ratingId, userId, emoji);
  }
}
