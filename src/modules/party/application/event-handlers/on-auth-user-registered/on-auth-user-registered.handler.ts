import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CreatePersonPartyCommand } from '../../commands/create-person-party/create-person-party.command';
import { AuthUserRegisteredEvent } from '@module/user/domain';

@EventsHandler(AuthUserRegisteredEvent)
export class OnAuthUserRegisteredHandler implements IEventHandler<AuthUserRegisteredEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: AuthUserRegisteredEvent): Promise<void> {
    await this.commandBus.execute(
      new CreatePersonPartyCommand({
        userId: event.payload.userId,
        marketId: event.payload.marketId,
        role: event.payload.role,
        correlationId: event.payload.correlationId,
      }),
    );
  }
}
