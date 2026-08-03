import { Command } from '@nestjs/cqrs';
import { AddressDto, CreateAddressPayload } from '@module/address';

export class CreateAddressCommand extends Command<AddressDto> {
  constructor(public readonly payload: CreateAddressPayload) {
    super();
  }
}
