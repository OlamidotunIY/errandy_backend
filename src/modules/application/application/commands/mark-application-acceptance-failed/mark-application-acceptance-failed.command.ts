import { ApplicationId } from '../../../domain';
import { Command } from '@nestjs/cqrs';
import { MarkApplicationAcceptanceFailedPayload } from './mark-application-acceptance-failed.payload';

export class MarkApplicationAcceptanceFailedCommand extends Command<void> {
  constructor(public readonly payload: MarkApplicationAcceptanceFailedPayload) {
    super();
  }
}
