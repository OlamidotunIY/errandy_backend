export interface BookServiceRequestDto {
  clientId: string;
  serviceId: string;
  addressId: string;
}

export interface BookServiceResponseDto {
  errandId: string;
  status: 'ASSIGNED';
}
