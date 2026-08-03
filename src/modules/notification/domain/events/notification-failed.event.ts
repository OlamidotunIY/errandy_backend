import { BaseDomainEvent } from '@src/common';
import { NotificationLog } from '../entities';
import { NotificationLogId } from '../value-objects';

interface NotificationFailedPayload {
  notificationLogId: string;
  userId: string;
  channel: string;
  failureReason: string;
}

export class NotificationFailedEvent extends BaseDomainEvent<
  NotificationLogId,
  NotificationFailedPayload
> {
  constructor(
    aggregateId: NotificationLogId,
    correlationId: string | undefined,
    payload: NotificationFailedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: NotificationFailedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    log: NotificationLog,
    correlationId?: string,
  ): NotificationFailedEvent {
    return new NotificationFailedEvent(log.id, correlationId, {
      notificationLogId: log.id.value,
      userId: log.userId,
      channel: log.channel,
      failureReason: log.failureReason ?? 'unknown',
    });
  }
}
