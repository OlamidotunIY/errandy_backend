import { BaseDomainEvent } from '@src/common';
import { NotificationLog } from '../entities';
import { NotificationLogId } from '../value-objects';

interface NotificationSentPayload {
  notificationLogId: string;
  userId: string;
  channel: string;
}

export class NotificationSentEvent extends BaseDomainEvent<
  NotificationLogId,
  NotificationSentPayload
> {
  constructor(
    aggregateId: NotificationLogId,
    correlationId: string | undefined,
    payload: NotificationSentPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: NotificationSentEvent.name,
      payload,
    });
  }

  static fromAggregate(
    log: NotificationLog,
    correlationId?: string,
  ): NotificationSentEvent {
    return new NotificationSentEvent(log.id, correlationId, {
      notificationLogId: log.id.value,
      userId: log.userId,
      channel: log.channel,
    });
  }
}
