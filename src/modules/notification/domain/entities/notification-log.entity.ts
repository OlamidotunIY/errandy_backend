import { AggregateRoot } from '@src/common';
import { NotificationLogId } from '../value-objects';
import { NotificationSentEvent, NotificationFailedEvent } from '../events';

interface NotificationLogProps {
  id: NotificationLogId;
  userId: string;
  type: string;
  channel: string;
  payload: Record<string, unknown>;
  status: 'SENT' | 'FAILED';
  failureReason: string | null;
  createdAt: Date;
}

export class NotificationLog extends AggregateRoot<NotificationLogId> {
  private _status: 'SENT' | 'FAILED';
  private _failureReason: string | null;

  private constructor(private readonly props: NotificationLogProps) {
    super(props.id);
    this._status = props.status;
    this._failureReason = props.failureReason;
  }

  static create(
    userId: string,
    type: string,
    channel: string,
    payload: Record<string, unknown>,
  ): NotificationLog {
    return new NotificationLog({
      id: NotificationLogId.create(),
      userId,
      type,
      channel,
      payload,
      status: 'SENT',
      failureReason: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get type(): string {
    return this.props.type;
  }

  get channel(): string {
    return this.props.channel;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get status(): 'SENT' | 'FAILED' {
    return this._status;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  markSent(): void {
    this._status = 'SENT';
    this._failureReason = null;

    this.addDomainEvent(
      NotificationSentEvent.fromAggregate(this, crypto.randomUUID()),
    );
  }

  markFailed(reason: string): void {
    this._status = 'FAILED';
    this._failureReason = reason;

    this.addDomainEvent(
      NotificationFailedEvent.fromAggregate(this, crypto.randomUUID()),
    );
  }
}
