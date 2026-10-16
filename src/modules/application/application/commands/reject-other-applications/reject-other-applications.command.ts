import { Command } from '@nestjs/cqrs';
import { RejectOtherApplicationsPayload } from './reject-other-applications.payload';

export class RejectOtherApplicationsCommand extends Command<void> {
  constructor(public readonly payload: RejectOtherApplicationsPayload) {
    super();
  }
}
