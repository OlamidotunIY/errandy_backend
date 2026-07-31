import { Command } from '@nestjs/cqrs';
import { RejectOtherApplicationsPayload } from './';

export class RejectOtherApplicationsCommand extends Command<void> {
  constructor(public readonly payload: RejectOtherApplicationsPayload) {
    super();
  }
}
