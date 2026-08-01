export interface ListServiceRequestDto {
  listedById: string;
  categoryId: string;
  title: string;
  description: string;
  price: { amountMinorUnits: number; currency: string };
}

export interface ListServiceResponseDto {
  serviceId: string;
}
