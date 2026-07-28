import { Command } from '@nestjs/cqrs';
import { RejectApplicationPayload } from '@application/application';

export class RejectApplicationCommand extends Command<void> {
  constructor(public readonly payload: RejectApplicationPayload) {
    super();
  }
}
