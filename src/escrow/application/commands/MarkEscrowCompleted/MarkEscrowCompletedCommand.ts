import { Command } from '@nestjs/cqrs';
import { MarkEscrowCompletedPayload } from '@escrow/application';

export class MarkEscrowCompletedCommand extends Command<void> {
  constructor(public readonly payload: MarkEscrowCompletedPayload) {
    super();
  }
}
