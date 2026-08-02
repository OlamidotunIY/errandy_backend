import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  AddressMapper,
  CreateAddressHandler,
  IAddressRepository,
  PrismaAddressRepository,
} from '@module/address';

@Module({
  imports: [CqrsModule],
  providers: [
    AddressMapper,
    {
      provide: IAddressRepository,
      useClass: PrismaAddressRepository,
    },
    CreateAddressHandler,
  ],
  exports: [IAddressRepository],
})
export class AddressModule {}
