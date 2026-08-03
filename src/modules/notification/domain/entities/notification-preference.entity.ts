import { AggregateRoot } from '@src/common';
import { NotificationPreferenceId } from '../value-objects';

interface NotificationPreferenceProps {
  id: NotificationPreferenceId;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  updatedAt: Date;
}

export class NotificationPreference extends AggregateRoot<NotificationPreferenceId> {
  private _emailEnabled: boolean;
  private _smsEnabled: boolean;
  private _pushEnabled: boolean;

  private constructor(private readonly props: NotificationPreferenceProps) {
    super(props.id);
    this._emailEnabled = props.emailEnabled;
    this._smsEnabled = props.smsEnabled;
    this._pushEnabled = props.pushEnabled;
  }

  static create(userId: string): NotificationPreference {
    return new NotificationPreference({
      id: NotificationPreferenceId.create(),
      userId,
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      updatedAt: new Date(),
    });
  }

  static reconstitute(
    props: NotificationPreferenceProps,
  ): NotificationPreference {
    return new NotificationPreference(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get emailEnabled(): boolean {
    return this._emailEnabled;
  }

  get smsEnabled(): boolean {
    return this._smsEnabled;
  }

  get pushEnabled(): boolean {
    return this._pushEnabled;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updatePreferences(
    emailEnabled?: boolean,
    smsEnabled?: boolean,
    pushEnabled?: boolean,
  ): void {
    if (emailEnabled !== undefined) this._emailEnabled = emailEnabled;
    if (smsEnabled !== undefined) this._smsEnabled = smsEnabled;
    if (pushEnabled !== undefined) this._pushEnabled = pushEnabled;
    this.props.updatedAt = new Date();
  }

  isChannelEnabled(channel: 'EMAIL' | 'SMS' | 'PUSH'): boolean {
    switch (channel) {
      case 'EMAIL':
        return this._emailEnabled;
      case 'SMS':
        return this._smsEnabled;
      case 'PUSH':
        return this._pushEnabled;
    }
  }
}
