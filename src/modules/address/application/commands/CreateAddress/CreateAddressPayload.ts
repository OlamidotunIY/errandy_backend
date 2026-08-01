import { UserId } from '@module/user';
import { CoordinatesType } from '@module/address';

export interface CreateAddressPayload {
  userId: UserId;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  coordinates: CoordinatesType;
}

export interface AddressDto {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}
