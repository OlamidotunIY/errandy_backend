interface CreatePersonPartyRequestDto {
  userId: string;
  marketId: string;
  role?: 'client' | 'provider';
  correlationId?: string;
}

interface CreatePersonPartyResponseDto {
  partyId: string;
}

export { CreatePersonPartyResponseDto, CreatePersonPartyRequestDto };
