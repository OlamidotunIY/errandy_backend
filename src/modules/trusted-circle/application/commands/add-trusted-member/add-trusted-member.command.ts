import { Command } from '@nestjs/cqrs';

export interface AddTrustedMemberDto {
  ownerPartyId: string;
  memberPartyId: string;
  status?: 'CONFIRMED' | 'SUGGESTED';
  sharedFromPartyId?: string;
  correlationId?: string;
}

export class AddTrustedMemberCommand extends Command<void> {
  constructor(public readonly payload: AddTrustedMemberDto) {
    super();
  }
}
