import { MarkEscrowCompletedPayload } from '@module/escrow';
import { Command } from '@nestjs/cqrs';

export class MarkEscrowCompletedCommand extends Command<void> {
  constructor(public readonly payload: MarkEscrowCompletedPayload) {
    super();
  }
}
