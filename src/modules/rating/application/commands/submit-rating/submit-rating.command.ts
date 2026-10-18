import { Command } from '@nestjs/cqrs';

export interface SubmitRatingDto {
  errandId: string;
  raterPartyId: string;
  rateePartyId: string;
  score: number;
  comment?: string;
  context?: 'CLIENT_FACING' | 'INTERNAL';
  correlationId?: string;
}

export class SubmitRatingCommand extends Command<string> {
  constructor(public readonly payload: SubmitRatingDto) {
    super();
  }
}
