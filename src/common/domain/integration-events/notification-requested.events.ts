/**
 * Integration events: the only way a module asks another module to perform
 * a write (here: deliver a message). The owning module (Notification) handles
 * them; publishers never depend on it.
 */

export type NotificationChannelName = 'EMAIL' | 'SMS' | 'PUSH';

/** Request to deliver a user-targeted notification honouring preferences/templates. */
export class NotificationRequestedEvent {
  constructor(
    public readonly payload: {
      userId: string;
      type: string;
      channel: NotificationChannelName;
      payload: Record<string, unknown>;
    },
  ) {}
}

/** Request to send a raw transactional email (e.g. auth emails) with no user context. */
export class EmailDeliveryRequestedEvent {
  constructor(public readonly payload: Record<string, unknown>) {}
}

/** Request to send a raw SMS (e.g. OTP codes) with no user context. */
export class SmsDeliveryRequestedEvent {
  constructor(public readonly payload: Record<string, unknown>) {}
}
