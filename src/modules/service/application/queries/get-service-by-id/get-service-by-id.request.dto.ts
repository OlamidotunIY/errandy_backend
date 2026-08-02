export interface GetServiceByIdRequestDto {
  serviceId: string;
}

export interface ServiceResponseDto {
  id: string;
  listedById: string;
  categoryId: string;
  title: string;
  description: string;
  price: { amountMinorUnits: number; currency: string };
}
