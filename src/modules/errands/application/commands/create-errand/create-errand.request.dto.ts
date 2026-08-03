export interface CreateErrandRequestDto {
  clientPartyId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
}

export interface CreateErrandResponseDto {
  errandId: string;
  status: 'DRAFT';
}
