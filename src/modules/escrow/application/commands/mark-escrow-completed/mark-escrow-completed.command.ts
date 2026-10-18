import { MarkEscrowCompletedPayload } from './mark-escrow-completed.payload';
import { Command } from '@nestjs/cqrs';

export class MarkEscrowCompletedCommand extends Command<void> {
  constructor(public readonly payload: MarkEscrowCompletedPayload) {
    super();
  }
}
