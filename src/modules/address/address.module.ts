import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  AddressMapper,
  AddressResolver,
  CreateAddressHandler,
  GetUserAddressesHandler,
  SetDefaultAddressHandler,
  DeleteAddressHandler,
  IAddressRepository,
  PrismaAddressRepository,
} from '@module/address';

@Module({
  imports: [CqrsModule],
  providers: [
    AddressMapper,
    AddressResolver,
    {
      provide: IAddressRepository,
      useClass: PrismaAddressRepository,
    },
    CreateAddressHandler,
    GetUserAddressesHandler,
    SetDefaultAddressHandler,
    DeleteAddressHandler,
  ],
  exports: [IAddressRepository],
})
export class AddressModule {}
