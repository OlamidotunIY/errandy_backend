export interface BookServiceRequestDto {
  clientPartyId: string;
  serviceId: string;
  addressId: string;
}

export interface BookServiceResponseDto {
  errandId: string;
  status: 'ASSIGNED';
}
