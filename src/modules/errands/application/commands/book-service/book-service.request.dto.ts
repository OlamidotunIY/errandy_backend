export interface BookServiceRequestDto {
  clientId: string;
  serviceId: string;
  addressId: string;
  // The following are accepted until the `service` module's infrastructure
  // layer exists to resolve them from the Service listing itself.
  categoryId: string;
  title: string;
  description: string;
  budget: { amountMinorUnits: number; currency: string };
  assignedProfileId: string;
  location?: { latitude: number; longitude: number };
}

export interface BookServiceResponseDto {
  errandId: string;
  status: 'ASSIGNED';
}
