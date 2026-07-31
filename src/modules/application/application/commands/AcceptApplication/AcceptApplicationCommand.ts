import { Command } from '@nestjs/cqrs';
import { AcceptApplicationPayload } from './';

export class AcceptApplicationCommand extends Command<void> {
  constructor(public readonly payload: AcceptApplicationPayload) {
    super();
  }
}
