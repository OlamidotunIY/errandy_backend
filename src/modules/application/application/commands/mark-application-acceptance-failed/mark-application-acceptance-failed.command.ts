import { ApplicationId } from '@src/modules';
import { Command } from '@nestjs/cqrs';
import { MarkApplicationAcceptanceFailedPayload } from './';

export class MarkApplicationAcceptanceFailedCommand extends Command<void> {
  constructor(public readonly payload: MarkApplicationAcceptanceFailedPayload) {
    super();
  }
}
