import { EntityId } from '@src/common';

export class NotificationPreferenceId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): NotificationPreferenceId {
    return new NotificationPreferenceId(crypto.randomUUID());
  }

  static fromString(value: string): NotificationPreferenceId {
    return new NotificationPreferenceId(value);
  }
}
