import { Command } from '@nestjs/cqrs';
import { AcceptApplicationPayload } from 'src/modules/application/application';

export class AcceptApplicationCommand extends Command<void> {
  constructor(public readonly payload: AcceptApplicationPayload) {
    super();
  }
}
