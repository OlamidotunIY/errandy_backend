import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CreatePersonPartyCommand } from '@module/party';
import { AuthUserRegisteredEvent } from '@module/user';

@EventsHandler(AuthUserRegisteredEvent)
export class OnAuthUserRegisteredHandler implements IEventHandler<AuthUserRegisteredEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: AuthUserRegisteredEvent): Promise<void> {
    await this.commandBus.execute(
      new CreatePersonPartyCommand({
        userId: event.payload.userId,
        marketId: event.payload.marketId,
        correlationId: event.payload.correlationId,
      }),
    );
  }
}
