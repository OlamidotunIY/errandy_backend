import {
  AcceptApplicationProgressId,
  AcceptApplicationProgressStatus,
  ApplicationId,
} from '@module/application/domain';
import { ErrandId } from '@module/errand';
import { AggregateRoot } from '@src/common';

export class AcceptApplicationProgress extends AggregateRoot<AcceptApplicationProgressId> {
  constructor(
    public readonly id: AcceptApplicationProgressId,
    private readonly _applicationId: ApplicationId,
    private readonly _errandId: ErrandId,
    private readonly _correlationId: string,
    private _status: AcceptApplicationProgressStatus,
    private _gatewayReference: string | null,
    public createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    applicationId: ApplicationId,
    errandId: ErrandId,
  ): AcceptApplicationProgress {
    const status = AcceptApplicationProgressStatus.CHARGE_INITIATED;
    const correlationId = crypto.randomUUID();
    const id = AcceptApplicationProgressId.create();

    return new AcceptApplicationProgress(
      id,
      applicationId,
      errandId,
      correlationId,
      status,
      null,
      new Date(),
      new Date(),
    );
  }

  status(): AcceptApplicationProgressStatus {
    return this._status;
  }

  recordGatewayReference(gatewayReference: string): void {
    this._gatewayReference = gatewayReference;
  }

  markErrandAssigned(): void {
    this._status = AcceptApplicationProgressStatus.ASSIGNED;
  }

  markAccepted(): void {
    this._status = AcceptApplicationProgressStatus.ACCEPTED;
  }

  markCompleted(): void {
    this._status = AcceptApplicationProgressStatus.COMPLETED;
  }

  markFailed(): void {
    this._status = AcceptApplicationProgressStatus.CHARGE_FAILED;
  }
}
