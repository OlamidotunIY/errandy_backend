import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { SubmitRatingCommand } from './submit-rating.command';
import { IRatingRepository, Rating } from '../../../domain';
import { randomUUID } from 'crypto';

@CommandHandler(SubmitRatingCommand)
export class SubmitRatingHandler
  implements ICommandHandler<SubmitRatingCommand, string>
{
  constructor(
    private readonly ratingRepository: IRatingRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SubmitRatingCommand): Promise<string> {
    const {
      errandId,
      raterPartyId,
      rateePartyId,
      score,
      comment,
      context,
      correlationId,
    } = command.payload;
    const id = randomUUID();

    const rating = Rating.create(
      id,
      errandId,
      raterPartyId,
      rateePartyId,
      score,
      comment,
      context,
      correlationId,
    );

    await this.ratingRepository.save(rating);

    for (const event of rating.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    return id;
  }
}
