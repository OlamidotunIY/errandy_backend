import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IAddressReadPort } from '@src/common';
import {
  CreateAddressHandler,
  GetUserAddressesHandler,
  SetDefaultAddressHandler,
  DeleteAddressHandler,
} from './application';
import { IAddressRepository } from './domain';
import { AddressMapper, AddressReadAdapter, PrismaAddressRepository } from './infrastructure';
import { AddressResolver } from './presentation';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    AddressMapper,
    AddressResolver,
    {
      provide: IAddressRepository,
      useClass: PrismaAddressRepository,
    },
    AddressReadAdapter,
    {
      provide: IAddressReadPort,
      useClass: AddressReadAdapter,
    },
    CreateAddressHandler,
    GetUserAddressesHandler,
    SetDefaultAddressHandler,
    DeleteAddressHandler,
  ],
  exports: [IAddressReadPort],
})
export class AddressModule {}
