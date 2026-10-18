import { Command } from '@nestjs/cqrs';

export interface SubmitVerificationStepDto {
  partyId: string;
  stepType: string;
  documentUrls: string[];
}

export class SubmitVerificationStepCommand extends Command<void> {
  constructor(public readonly payload: SubmitVerificationStepDto) {
    super();
  }
}
