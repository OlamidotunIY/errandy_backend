export interface UpdateServicePriceRequestDto {
  serviceId: string;
  price: { amountMinorUnits: number; currency: string };
}

export interface UpdateServicePriceResponseDto {
  serviceId: string;
}
