export interface InitiateChargeRequestDto {
  clientPartyId: string;
  purposeId: string;
  amount: number;
  paymentMethodId: string;
}

export interface InitiateChargeResponseDto {
  gatewayReference: string;
}
