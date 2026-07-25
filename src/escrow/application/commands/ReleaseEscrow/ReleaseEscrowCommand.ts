import { Command } from '@nestjs/cqrs';
import { ReleaseEscrowPayload } from '@escrow/application';

class ReleaseEscrowCommand extends Command<void> {
  constructor(public readonly payload: ReleaseEscrowPayload) {
    super();
  }
}

export { ReleaseEscrowCommand };
