import { DisputeOpenedEvent } from '../events';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeProps {
  id: string;
  errandId: string;
  raisedById: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolution?: string | null;
  resolvedById?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Dispute {
  private _id: string;
  private _errandId: string;
  private _raisedById: string;
  private _reason: string;
  private _description: string;
  private _evidenceUrls: string[];
  private _status: DisputeStatus;
  private _resolution?: string | null;
  private _resolvedById?: string | null;
  private _resolvedAt?: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: any[] = [];

  constructor(props: DisputeProps) {
    this._id = props.id;
    this._errandId = props.errandId;
    this._raisedById = props.raisedById;
    this._reason = props.reason;
    this._description = props.description;
    this._evidenceUrls = props.evidenceUrls || [];
    this._status = props.status || 'OPEN';
    this._resolution = props.resolution ?? null;
    this._resolvedById = props.resolvedById ?? null;
    this._resolvedAt = props.resolvedAt ?? null;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  static open(
    id: string,
    errandId: string,
    raisedById: string,
    providerPartyId: string,
    reason: string,
    description: string,
    evidenceUrls: string[] = [],
    correlationId?: string,
  ): Dispute {
    const dispute = new Dispute({
      id,
      errandId,
      raisedById,
      reason,
      description,
      evidenceUrls,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    dispute.addDomainEvent(
      new DisputeOpenedEvent({
        partyId: providerPartyId,
        correlationId,
      }),
    );

    return dispute;
  }

  get id(): string {
    return this._id;
  }

  get errandId(): string {
    return this._errandId;
  }

  get raisedById(): string {
    return this._raisedById;
  }

  get reason(): string {
    return this._reason;
  }

  get description(): string {
    return this._description;
  }

  get evidenceUrls(): string[] {
    return this._evidenceUrls;
  }

  get status(): DisputeStatus {
    return this._status;
  }

  get resolution(): string | null | undefined {
    return this._resolution;
  }

  get resolvedById(): string | null | undefined {
    return this._resolvedById;
  }

  get resolvedAt(): Date | null | undefined {
    return this._resolvedAt;
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

  underReview(): void {
    this._status = 'UNDER_REVIEW';
    this._updatedAt = new Date();
  }

  resolve(resolution: string, adminUserId: string): void {
    this._status = 'RESOLVED';
    this._resolution = resolution;
    this._resolvedById = adminUserId;
    this._resolvedAt = new Date();
    this._updatedAt = new Date();
  }

  reject(reason: string, adminUserId: string): void {
    this._status = 'REJECTED';
    this._resolution = reason;
    this._resolvedById = adminUserId;
    this._resolvedAt = new Date();
    this._updatedAt = new Date();
  }

  toPrimitives(): DisputeProps {
    return {
      id: this._id,
      errandId: this._errandId,
      raisedById: this._raisedById,
      reason: this._reason,
      description: this._description,
      evidenceUrls: this._evidenceUrls,
      status: this._status,
      resolution: this._resolution,
      resolvedById: this._resolvedById,
      resolvedAt: this._resolvedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
