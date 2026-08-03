import { Command } from '@nestjs/cqrs';
import { ReleaseEscrowPayload } from 'src/modules/escrow/application';

class ReleaseEscrowCommand extends Command<void> {
  constructor(public readonly payload: ReleaseEscrowPayload) {
    super();
  }
}

export { ReleaseEscrowCommand };
