import { PartyId } from '@module/party';
import { ApplicationId, ApplicationStatus, ApplicationType } from '../';
import { ApplicationInvariantError } from '../errors';
import {
  ApplicationAcceptedEvent,
  ApplicationRejectedEvent,
  ApplicationSubmittedEvent,
} from '../events';
import { AggregateRoot } from '@src/common';
import { ErrandId } from '@module/errands';

export class Application extends AggregateRoot<ApplicationId> {
  constructor(
    public readonly id: ApplicationId,
    public readonly errandId: ErrandId,
    public readonly workerId: PartyId,
    private _status: ApplicationStatus,
    private _type: ApplicationType,
    private readonly _proposal: string,
    private readonly _proposedAmountMinorUnits: number,
    private readonly _currency: string,
    private _acceptedAt: Date | null,
    private _rejectedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    errandId: ErrandId,
    workerId: PartyId,
    proposal: string,
    proposedAmountMinorUnits: number,
    currency: string,
    applicationType: ApplicationType,
  ): Application {
    if (proposedAmountMinorUnits <= 0) {
      throw new ApplicationInvariantError(
        'Proposed amount must be greater than zero',
      );
    }
    if (!currency) {
      throw new ApplicationInvariantError('Currency must be provided');
    }

    const id = ApplicationId.create();
    const status = ApplicationStatus.PENDING;
    const acceptedAt = null;
    const rejectedAt = null;
    const createdAt = new Date();
    const updatedAt = new Date();

    const application = new Application(
      id,
      errandId,
      workerId,
      status,
      applicationType,
      proposal,
      proposedAmountMinorUnits,
      currency,
      acceptedAt,
      rejectedAt,
      createdAt,
      updatedAt,
    );

    application.addDomainEvent(
      ApplicationSubmittedEvent.fromAggregate(application, crypto.randomUUID()),
    );

    return application;
  }

  static reconstitute(props: {
    id: ApplicationId;
    errandId: ErrandId;
    workerId: PartyId;
    status: ApplicationStatus;
    type: ApplicationType;
    proposal: string;
    proposedAmountMinorUnits: number;
    currency: string;
    acceptedAt: Date | null;
    rejectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Application {
    return new Application(
      props.id,
      props.errandId,
      props.workerId,
      props.status,
      props.type,
      props.proposal,
      props.proposedAmountMinorUnits,
      props.currency,
      props.acceptedAt,
      props.rejectedAt,
      props.createdAt,
      props.updatedAt,
    );
  }

  accept(): void {
    if (this._status !== ApplicationStatus.PENDING) {
      throw new ApplicationInvariantError(
        'Only pending applications can be accepted',
      );
    }

    this._status = ApplicationStatus.ACCEPTED;
    this._acceptedAt = new Date();

    this.addDomainEvent(
      ApplicationAcceptedEvent.fromAggregate(this, crypto.randomUUID()),
    );
  }

  reject(correlationId?: string): void {
    if (this._status !== ApplicationStatus.PENDING) {
      throw new ApplicationInvariantError(
        'Only pending applications can be rejected',
      );
    }

    this._status = ApplicationStatus.REJECTED;
    this._rejectedAt = new Date();
    this.updatedAt = new Date();

    this.addDomainEvent(
      ApplicationRejectedEvent.fromAggregate(
        this,
        correlationId ?? crypto.randomUUID(),
      ),
    );
  }

  isPending(): boolean {
    return this._status === ApplicationStatus.PENDING;
  }

  isAccepted(): boolean {
    return this._status === ApplicationStatus.ACCEPTED;
  }

  isRejected(): boolean {
    return this._status === ApplicationStatus.REJECTED;
  }

  isTerminal(): boolean {
    return (
      this._status === ApplicationStatus.ACCEPTED ||
      this._status === ApplicationStatus.REJECTED
    );
  }

  canBeAccepted(): boolean {
    return this._status === ApplicationStatus.PENDING;
  }

  canBeRejected(): boolean {
    return this._status === ApplicationStatus.PENDING;
  }

  status(): ApplicationStatus {
    return this._status;
  }

  type(): ApplicationType {
    return this._type;
  }

  proposal(): string {
    return this._proposal;
  }

  proposedAmountMinorUnits(): number {
    return this._proposedAmountMinorUnits;
  }

  currency(): string {
    return this._currency;
  }

  acceptedAt(): Date | null {
    return this._acceptedAt;
  }

  rejectedAt(): Date | null {
    return this._rejectedAt;
  }
}
