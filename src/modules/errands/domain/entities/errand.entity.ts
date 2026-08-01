import { AggregateRoot } from '@src/common';
import { Money } from '@module/escrow/domain';
import { ErrandId } from '../value-objects';
import { ErrandStatus, SourceType, CompletedBy } from '../value-objects';
import { ErrandAssignment } from './errand-assignment.entity';
import {
  ErrandCreatedEvent,
  ErrandPublishedEvent,
  ErrandAssignedEvent,
  ErrandStartedEvent,
  ErrandCompletedEvent,
  ErrandArchivedEvent,
} from '../events';
import {
  ErrandInvariantError,
  NotAllAssignmentsConfirmedError,
} from '../errors';

export class Errand extends AggregateRoot<ErrandId> {
  constructor(
    public readonly id: ErrandId,
    private readonly _clientId: string,
    private readonly _categoryId: string,
    private _title: string,
    private _description: string,
    private readonly _addressId: string,
    private readonly _location: unknown,
    private readonly _budget: Money,
    private _status: ErrandStatus,
    private readonly _sourceType: SourceType,
    private readonly _requiredTier: string,
    private readonly _marketId: string,
    private _serviceId: string | undefined,
    private _acceptedApplicationId: string | undefined,
    private _workerPoolPercentageOverride: number | undefined,
    private _startedAt: Date | undefined,
    private _completedAt: Date | undefined,
    private _completedBy: CompletedBy | undefined,
    private _cancelledAt: Date | undefined,
    private readonly _relistedFromErrandId: string | undefined,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    clientId: string,
    categoryId: string,
    title: string,
    description: string,
    addressId: string,
    location: unknown,
    budget: Money,
    marketId: string,
    sourceType: SourceType = SourceType.OPEN_BID,
    requiredTier = 'COMMUNITY',
    correlationId?: string,
  ): Errand {
    const errand = new Errand(
      ErrandId.create(),
      clientId,
      categoryId,
      title,
      description,
      addressId,
      location,
      budget,
      ErrandStatus.DRAFT,
      sourceType,
      requiredTier,
      marketId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new Date(),
      new Date(),
    );

    errand.addDomainEvent(
      new ErrandCreatedEvent(errand.id, correlationId, {
        errandId: errand.id.value,
        clientId: errand._clientId,
        sourceType: errand._sourceType,
      }),
    );

    return errand;
  }

  get clientId(): string {
    return this._clientId;
  }

  get categoryId(): string {
    return this._categoryId;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get addressId(): string {
    return this._addressId;
  }

  get location(): unknown {
    return this._location;
  }

  get budget(): Money {
    return this._budget;
  }

  get status(): ErrandStatus {
    return this._status;
  }

  get sourceType(): SourceType {
    return this._sourceType;
  }

  get requiredTier(): string {
    return this._requiredTier;
  }

  get marketId(): string {
    return this._marketId;
  }

  get serviceId(): string | undefined {
    return this._serviceId;
  }

  get acceptedApplicationId(): string | undefined {
    return this._acceptedApplicationId;
  }

  get workerPoolPercentageOverride(): number | undefined {
    return this._workerPoolPercentageOverride;
  }

  get startedAt(): Date | undefined {
    return this._startedAt;
  }

  get completedAt(): Date | undefined {
    return this._completedAt;
  }

  get completedBy(): CompletedBy | undefined {
    return this._completedBy;
  }

  get cancelledAt(): Date | undefined {
    return this._cancelledAt;
  }

  get relistedFromErrandId(): string | undefined {
    return this._relistedFromErrandId;
  }

  isOpen(): boolean {
    return (
      this._status === ErrandStatus.DRAFT ||
      this._status === ErrandStatus.PUBLISHED
    );
  }

  isAssigned(): boolean {
    return this._status === ErrandStatus.ASSIGNED;
  }

  hasStarted(): boolean {
    return (
      this._status === ErrandStatus.IN_PROGRESS ||
      this._status === ErrandStatus.COMPLETED
    );
  }

  allAssignmentsConfirmed(assignments: ErrandAssignment[]): boolean {
    return (
      assignments.length > 0 && assignments.every((a) => a.isConfirmedDone())
    );
  }

  publish(correlationId?: string): void {
    if (this._status !== ErrandStatus.DRAFT) {
      throw new ErrandInvariantError('Only a DRAFT errand can be published');
    }

    this._status = ErrandStatus.PUBLISHED;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ErrandPublishedEvent(this.id, correlationId, {
        errandId: this.id.value,
      }),
    );
  }

  assignTo(applicationId: string, correlationId?: string): void {
    if (
      this._status !== ErrandStatus.DRAFT &&
      this._status !== ErrandStatus.PUBLISHED
    ) {
      throw new ErrandInvariantError(
        'Only a DRAFT or PUBLISHED errand can be assigned',
      );
    }

    this._status = ErrandStatus.ASSIGNED;
    this._acceptedApplicationId = applicationId;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ErrandAssignedEvent(this.id, correlationId, {
        errandId: this.id.value,
        acceptedApplicationId: applicationId,
      }),
    );
  }

  start(correlationId?: string): void {
    if (this._status !== ErrandStatus.ASSIGNED) {
      throw new ErrandInvariantError('Only an ASSIGNED errand can be started');
    }

    this._status = ErrandStatus.IN_PROGRESS;
    this._startedAt = new Date();
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ErrandStartedEvent(this.id, correlationId, {
        errandId: this.id.value,
      }),
    );
  }

  complete(
    completedBy: CompletedBy,
    assignments: ErrandAssignment[],
    correlationId: string,
  ): void {
    if (!this.allAssignmentsConfirmed(assignments)) {
      throw new NotAllAssignmentsConfirmedError(this.id.value);
    }

    this._status = ErrandStatus.COMPLETED;
    this._completedAt = new Date();
    this._completedBy = completedBy;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ErrandCompletedEvent(this.id, correlationId, {
        errandId: this.id.value,
        completedBy,
      }),
    );
  }

  archive(correlationId?: string): void {
    this._status = ErrandStatus.ARCHIVED;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new ErrandArchivedEvent(this.id, correlationId, {
        errandId: this.id.value,
      }),
    );
  }
}
