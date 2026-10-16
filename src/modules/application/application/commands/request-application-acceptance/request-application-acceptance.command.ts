import { Command } from '@nestjs/cqrs';
import { RequestApplicationAcceptancePayload } from './request-application-acceptance.payload';

export class RequestApplicationAcceptanceCommand extends Command<void> {
  constructor(public readonly payload: RequestApplicationAcceptancePayload) {
    super();
  }
}
