import { Command } from '@nestjs/cqrs';
import { RejectApplicationPayload } from 'src/modules/application/application';

export class RejectApplicationCommand extends Command<void> {
  constructor(public readonly payload: RejectApplicationPayload) {
    super();
  }
}
