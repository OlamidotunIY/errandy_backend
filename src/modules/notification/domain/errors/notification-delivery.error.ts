import { DomainError, DomainErrorStatus } from '@src/common';

export class NotificationDeliveryError extends DomainError {
  constructor(channel: string, reason: string) {
    super(`Failed to deliver ${channel} notification: ${reason}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
