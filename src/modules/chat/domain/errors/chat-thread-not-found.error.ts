import { DomainError, DomainErrorStatus } from '@src/common';

export class ChatThreadNotFoundError extends DomainError {
  constructor(threadId: string) {
    super(`Chat thread with id - ${threadId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
