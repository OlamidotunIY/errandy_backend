import { Command } from '@nestjs/cqrs';
import { AcceptApplicationPayload } from '@application/application';

export class AcceptApplicationCommand extends Command<void> {
  constructor(public readonly payload: AcceptApplicationPayload) {
    super();
  }
}
