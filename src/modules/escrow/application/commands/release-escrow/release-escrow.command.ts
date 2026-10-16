import { Command } from '@nestjs/cqrs';
import { ReleaseEscrowPayload } from './release-escrow.payload';

class ReleaseEscrowCommand extends Command<void> {
  constructor(public readonly payload: ReleaseEscrowPayload) {
    super();
  }
}

export { ReleaseEscrowCommand };
