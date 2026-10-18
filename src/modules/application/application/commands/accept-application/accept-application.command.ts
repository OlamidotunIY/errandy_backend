import { Command } from '@nestjs/cqrs';
import { AcceptApplicationPayload } from './accept-application.payload';

export class AcceptApplicationCommand extends Command<void> {
  constructor(public readonly payload: AcceptApplicationPayload) {
    super();
  }
}
