import { AggregateRoot } from '@nestjs/cqrs';
import { VerificationCompletedEvent } from '../events';
import { ProviderTier } from '@module/party';

export interface VerificationStepProps {
  stepType: string;
  status: string; // PENDING | SUBMITTED | APPROVED | REJECTED
  documentUrls: string[];
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewerId?: string | null;
  rejectionReason?: string | null;
}

export interface VerificationProfileProps {
  id: string;
  partyId: string;
  steps: VerificationStepProps[];
  overallStatus: string; // INCOMPLETE | COMPLETE
  createdAt: Date;
  updatedAt: Date;
}

export class VerificationProfile extends AggregateRoot {
  private _id: string;
  private _partyId: string;
  private _steps: VerificationStepProps[];
  private _overallStatus: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: VerificationProfileProps) {
    super();
    this._id = props.id;
    this._partyId = props.partyId;
    this._steps = props.steps || [];
    this._overallStatus = props.overallStatus || 'INCOMPLETE';
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  static create(id: string, partyId: string): VerificationProfile {
    return new VerificationProfile({
      id,
      partyId,
      steps: [],
      overallStatus: 'INCOMPLETE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  get id(): string {
    return this._id;
  }

  get partyId(): string {
    return this._partyId;
  }

  get steps(): VerificationStepProps[] {
    return this._steps;
  }

  get overallStatus(): string {
    return this._overallStatus;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  submitStep(stepType: string, documentUrls: string[]): void {
    const existingIndex = this._steps.findIndex((s) => s.stepType === stepType);
    const newStep: VerificationStepProps = {
      stepType,
      status: 'SUBMITTED',
      documentUrls,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewerId: null,
      rejectionReason: null,
    };

    if (existingIndex >= 0) {
      this._steps[existingIndex] = newStep;
    } else {
      this._steps.push(newStep);
    }
    this._updatedAt = new Date();
  }

  reviewStep(
    stepType: string,
    status: 'APPROVED' | 'REJECTED',
    reviewerId: string,
    rejectionReason?: string,
    correlationId?: string,
  ): void {
    const step = this._steps.find((s) => s.stepType === stepType);
    if (!step) {
      throw new Error(`Verification step ${stepType} not found`);
    }

    step.status = status;
    step.reviewedAt = new Date();
    step.reviewerId = reviewerId;
    step.rejectionReason = status === 'REJECTED' ? rejectionReason ?? null : null;
    this._updatedAt = new Date();

    if (status === 'APPROVED') {
      const ninStep = this._steps.find((s) => s.stepType === 'NIN_VERIFIED');
      if (ninStep && ninStep.status === 'APPROVED') {
        this._overallStatus = 'COMPLETE';
        this.apply(
          new VerificationCompletedEvent({
            partyId: this._partyId,
            tier: ProviderTier.VERIFIED,
            correlationId,
          }),
        );
      }
    }
  }

  toPrimitives(): VerificationProfileProps {
    return {
      id: this._id,
      partyId: this._partyId,
      steps: this._steps,
      overallStatus: this._overallStatus,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
