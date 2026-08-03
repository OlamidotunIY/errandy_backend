export interface SetDefaultPaymentMethodRequestDto {
  partyId: string;
  paymentMethodId: string;
}

export interface SetDefaultPaymentMethodResponseDto {
  partyId: string;
  defaultPaymentMethodId: string;
}
