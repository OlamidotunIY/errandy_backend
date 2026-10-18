import { Command } from '@nestjs/cqrs';

export interface ReviewVerificationStepDto {
  partyId: string;
  stepType: string;
  status: 'APPROVED' | 'REJECTED';
  reviewerId: string;
  rejectionReason?: string;
  correlationId?: string;
}

export class ReviewVerificationStepCommand extends Command<void> {
  constructor(public readonly payload: ReviewVerificationStepDto) {
    super();
  }
}
