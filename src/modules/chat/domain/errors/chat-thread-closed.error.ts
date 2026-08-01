import { DomainError, DomainErrorStatus } from '@src/common';

export class ChatThreadClosedError extends DomainError {
  constructor(threadId: string) {
    super(`Chat thread with id - ${threadId} is closed`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
