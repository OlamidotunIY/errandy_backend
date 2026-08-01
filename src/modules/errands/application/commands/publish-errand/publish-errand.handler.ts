import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PublishErrandCommand, PublishErrandResponseDto } from '.';
import { ErrandNotFoundError, IErrandRepository } from '@module/errands/domain';
import { ILogger } from '@src/common';

@CommandHandler(PublishErrandCommand)
export class PublishErrandHandler implements ICommandHandler<PublishErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: PublishErrandCommand,
  ): Promise<PublishErrandResponseDto> {
    const { errandId } = command.payload;

    const errand = await this.errandRepository.findById(errandId);
    if (!errand) {
      throw new ErrandNotFoundError(errandId);
    }

    errand.publish();
    await this.errandRepository.save(errand);

    for (const event of errand.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand published', { errandId });

    return { errandId, status: errand.status };
  }
}
