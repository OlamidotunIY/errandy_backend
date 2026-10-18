import { Command } from '@nestjs/cqrs';

export interface RemoveTrustedMemberDto {
  ownerPartyId: string;
  memberPartyId: string;
  correlationId?: string;
}

export class RemoveTrustedMemberCommand extends Command<void> {
  constructor(public readonly payload: RemoveTrustedMemberDto) {
    super();
  }
}
