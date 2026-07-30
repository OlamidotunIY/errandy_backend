import { ApplicationId } from 'src/modules/application/domain';
import { Command } from '@nestjs/cqrs';
import { SubmitApplicationPayload } from './SubmitApplicationPayload';

class SubmitApplicationCommand extends Command<ApplicationId> {
  constructor(public readonly payload: SubmitApplicationPayload) {
    super();
  }
}

export { SubmitApplicationCommand };
