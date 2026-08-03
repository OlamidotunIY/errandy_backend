import { EntityId } from '@src/common';

export class NotificationLogId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): NotificationLogId {
    return new NotificationLogId(crypto.randomUUID());
  }

  static fromString(value: string): NotificationLogId {
    return new NotificationLogId(value);
  }
}
