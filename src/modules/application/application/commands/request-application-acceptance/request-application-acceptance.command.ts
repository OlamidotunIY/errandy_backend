import { Command } from '@nestjs/cqrs';
import { RequestApplicationAcceptancePayload } from './';

export class RequestApplicationAcceptanceCommand extends Command<void> {
  constructor(public readonly payload: RequestApplicationAcceptancePayload) {
    super();
  }
}
