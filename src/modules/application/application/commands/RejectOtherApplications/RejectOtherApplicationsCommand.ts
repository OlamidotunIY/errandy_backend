import { Command } from '@nestjs/cqrs';
import { RejectOtherApplicationsPayload } from 'src/modules/application/application';

export class RejectOtherApplicationsCommand extends Command<void> {
  constructor(public readonly payload: RejectOtherApplicationsPayload) {
    super();
  }
}
