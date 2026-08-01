interface CreatePersonPartyRequestDto {
  userId: string;
  marketId: string;
}

interface CreatePersonPartyResponseDto {
  partyId: string;
}

export { CreatePersonPartyResponseDto, CreatePersonPartyRequestDto };
