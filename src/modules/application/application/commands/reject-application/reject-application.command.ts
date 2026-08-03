import { Command } from '@nestjs/cqrs';
import { RejectApplicationPayload } from './reject-application.payload';

export class RejectApplicationCommand extends Command<void> {
  constructor(public readonly payload: RejectApplicationPayload) {
    super();
  }
}
