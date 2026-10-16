import {
  TrustedCircleMemberConfirmedEvent,
  TrustedCircleMemberRemovedEvent,
} from '../events';

export interface TrustedCircleMemberProps {
  memberId: string;
  status: 'CONFIRMED' | 'SUGGESTED';
  sharedFromPartyId?: string | null;
  addedAt?: Date | null;
}

export interface TrustedCircleProps {
  id: string;
  ownerPartyId: string;
  members: TrustedCircleMemberProps[];
  createdAt: Date;
  updatedAt: Date;
}

export class TrustedCircle {
  private _id: string;
  private _ownerPartyId: string;
  private _members: TrustedCircleMemberProps[];
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: any[] = [];

  constructor(props: TrustedCircleProps) {
    this._id = props.id;
    this._ownerPartyId = props.ownerPartyId;
    this._members = props.members || [];
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  static create(id: string, ownerPartyId: string): TrustedCircle {
    return new TrustedCircle({
      id,
      ownerPartyId,
      members: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  get id(): string {
    return this._id;
  }

  get ownerPartyId(): string {
    return this._ownerPartyId;
  }

  get members(): TrustedCircleMemberProps[] {
    return this._members;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  addDomainEvent(event: any): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): any[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  addMember(
    memberId: string,
    status: 'CONFIRMED' | 'SUGGESTED' = 'CONFIRMED',
    sharedFromPartyId?: string,
    correlationId?: string,
  ): void {
    const existing = this._members.find((m) => m.memberId === memberId);
    if (existing) {
      if (existing.status !== 'CONFIRMED' && status === 'CONFIRMED') {
        existing.status = 'CONFIRMED';
        existing.addedAt = new Date();
        this._updatedAt = new Date();
        this.addDomainEvent(
          new TrustedCircleMemberConfirmedEvent({
            partyId: memberId,
            correlationId,
          }),
        );
      }
      return;
    }

    this._members.push({
      memberId,
      status,
      sharedFromPartyId: sharedFromPartyId ?? null,
      addedAt: new Date(),
    });
    this._updatedAt = new Date();

    if (status === 'CONFIRMED') {
      this.addDomainEvent(
        new TrustedCircleMemberConfirmedEvent({
          partyId: memberId,
          correlationId,
        }),
      );
    }
  }

  removeMember(memberId: string, correlationId?: string): void {
    const index = this._members.findIndex((m) => m.memberId === memberId);
    if (index === -1) return;

    const removed = this._members.splice(index, 1)[0];
    this._updatedAt = new Date();

    if (removed.status === 'CONFIRMED') {
      this.addDomainEvent(
        new TrustedCircleMemberRemovedEvent({
          partyId: memberId,
          correlationId,
        }),
      );
    }
  }

  toPrimitives(): TrustedCircleProps {
    return {
      id: this._id,
      ownerPartyId: this._ownerPartyId,
      members: this._members,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
