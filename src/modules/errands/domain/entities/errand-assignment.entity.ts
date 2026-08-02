import { AggregateRoot } from '@src/common';
import {
  ErrandAssignmentId,
  ErrandId,
  AssignmentStatus,
} from '../value-objects';
import { AssignmentConfirmedDoneEvent } from '../events';
import { AssignmentConfirmationUpdatedEvent } from '../events';
import { ErrandInvariantError } from '../errors';

export class ErrandAssignment extends AggregateRoot<ErrandAssignmentId> {
  constructor(
    public readonly id: ErrandAssignmentId,
    private readonly _errandId: ErrandId,
    private readonly _profileId: string,
    private readonly _assignedByOrganizationId: string | undefined,
    private _splitPercentage: number | undefined,
    private _status: AssignmentStatus,
    private _confirmedAt: Date | undefined,
    private _proofUrl: string | undefined,
    public readonly assignedAt: Date,
  ) {
    super(id);
  }

  static create(
    errandId: ErrandId,
    profileId: string,
    assignedByOrganizationId?: string,
    splitPercentage?: number,
  ): ErrandAssignment {
    return new ErrandAssignment(
      ErrandAssignmentId.create(),
      errandId,
      profileId,
      assignedByOrganizationId,
      splitPercentage,
      AssignmentStatus.ASSIGNED,
      undefined,
      undefined,
      new Date(),
    );
  }

  get errandId(): ErrandId {
    return this._errandId;
  }

  get profileId(): string {
    return this._profileId;
  }

  get assignedByOrganizationId(): string | undefined {
    return this._assignedByOrganizationId;
  }

  get splitPercentage(): number | undefined {
    return this._splitPercentage;
  }

  get status(): AssignmentStatus {
    return this._status;
  }

  get confirmedAt(): Date | undefined {
    return this._confirmedAt;
  }

  get proofUrl(): string | undefined {
    return this._proofUrl;
  }

  isConfirmedDone(): boolean {
    return this._status === AssignmentStatus.CONFIRMED_DONE;
  }

  confirmDone(
    profileId: string,
    proofUrl?: string,
    correlationId?: string,
  ): void {
    if (this._profileId !== profileId) {
      throw new ErrandInvariantError(
        'Only the assigned member may confirm their own assignment',
      );
    }
    if (this._status !== AssignmentStatus.ASSIGNED) {
      throw new ErrandInvariantError(
        'Assignment can only be confirmed done from ASSIGNED status',
      );
    }

    this._status = AssignmentStatus.CONFIRMED_DONE;
    this._confirmedAt = new Date();
    this._proofUrl = proofUrl;

    this.addDomainEvent(
      new AssignmentConfirmedDoneEvent(this.id, correlationId, {
        errandAssignmentId: this.id.value,
        errandId: this._errandId.value,
        profileId: this._profileId,
      }),
    );
  }

  updateConfirmation(
    profileId: string,
    proofUrl: string,
    errandCompleted: boolean,
    correlationId?: string,
  ): void {
    if (this._profileId !== profileId) {
      throw new ErrandInvariantError(
        'Only the assigned member may update their own confirmation',
      );
    }
    if (this._status !== AssignmentStatus.CONFIRMED_DONE) {
      throw new ErrandInvariantError(
        'Confirmation can only be updated while CONFIRMED_DONE',
      );
    }
    if (errandCompleted) {
      throw new ErrandInvariantError(
        'Confirmation cannot be updated once the errand is COMPLETED',
      );
    }

    this._proofUrl = proofUrl;

    this.addDomainEvent(
      new AssignmentConfirmationUpdatedEvent(this.id, correlationId, {
        errandAssignmentId: this.id.value,
        proofUrl,
      }),
    );
  }
}
