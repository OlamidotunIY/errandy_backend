export interface GetErrandByIdRequestDto {
  errandId: string;
}

export interface ErrandDetailResponseDto {
  id: string;
  clientPartyId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
  status: string;
  sourceType: string;
  requiredTier: string;
  marketId: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}
