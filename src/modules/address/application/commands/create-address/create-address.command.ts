import { Command } from '@nestjs/cqrs';
import { AddressDto, CreateAddressPayload } from './create-address.payload';

export class CreateAddressCommand extends Command<AddressDto> {
  constructor(public readonly payload: CreateAddressPayload) {
    super();
  }
}
