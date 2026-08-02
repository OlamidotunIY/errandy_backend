interface CreatePersonPartyRequestDto {
  userId: string;
  marketId: string;
  correlationId?: string;
}

interface CreatePersonPartyResponseDto {
  partyId: string;
}

export { CreatePersonPartyResponseDto, CreatePersonPartyRequestDto };
