import { Command } from '@nestjs/cqrs';
import { SubmitApplicationPayload } from './submit-application.payload';
import { ApplicationId } from '@module/application/domain';

class SubmitApplicationCommand extends Command<ApplicationId> {
  constructor(public readonly payload: SubmitApplicationPayload) {
    super();
  }
}

export { SubmitApplicationCommand };
