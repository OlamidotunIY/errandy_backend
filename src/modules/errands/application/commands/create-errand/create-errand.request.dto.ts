export interface CreateErrandRequestDto {
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
  location?: { latitude: number; longitude: number };
}

export interface CreateErrandResponseDto {
  errandId: string;
  status: 'DRAFT';
}
