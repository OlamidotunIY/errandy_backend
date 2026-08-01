import { Command } from '@nestjs/cqrs';
import { RejectApplicationPayload } from './RejectApplicationPayload';

export class RejectApplicationCommand extends Command<void> {
  constructor(public readonly payload: RejectApplicationPayload) {
    super();
  }
}
