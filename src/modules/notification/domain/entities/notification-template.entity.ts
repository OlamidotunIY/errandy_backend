import { AggregateRoot, EntityId } from '@src/common';

export class NotificationTemplateId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string) {
    return new NotificationTemplateId(value);
  }
}

export interface NotificationTemplateProps {
  id: NotificationTemplateId;
  marketId: string;
  type: string;
  resendTemplateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationTemplate extends AggregateRoot<NotificationTemplateId> {
  private _marketId: string;
  private _type: string;
  private _resendTemplateId: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: NotificationTemplateProps) {
    super(props.id);
    this._marketId = props.marketId;
    this._type = props.type;
    this._resendTemplateId = props.resendTemplateId;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static reconstitute(props: NotificationTemplateProps): NotificationTemplate {
    return new NotificationTemplate(props);
  }

  static create(
    marketId: string,
    type: string,
    resendTemplateId: string,
    id: string,
  ): NotificationTemplate {
    return new NotificationTemplate({
      id: NotificationTemplateId.create(id),
      marketId,
      type,
      resendTemplateId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  get marketId(): string {
    return this._marketId;
  }

  get type(): string {
    return this._type;
  }

  get resendTemplateId(): string {
    return this._resendTemplateId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  updateResendTemplateId(newResendTemplateId: string) {
    this._resendTemplateId = newResendTemplateId;
    this._updatedAt = new Date();
  }
}
