import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IServiceReadPort } from '@src/common';
import {
  DeactivateServiceHandler,
  GetServiceByIdHandler,
  ListServiceHandler,
  SearchServicesHandler,
  UpdateServicePriceHandler,
} from './application';
import { IServiceRepository } from './domain';
import { ServiceMapper, ServiceReadAdapter, ServiceRepository } from './infrastructure';
import { ServiceResolver } from './presentation';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    ServiceMapper,
    ServiceResolver,
    {
      provide: IServiceRepository,
      useClass: ServiceRepository,
    },
    ServiceReadAdapter,
    {
      provide: IServiceReadPort,
      useClass: ServiceReadAdapter,
    },
    ListServiceHandler,
    UpdateServicePriceHandler,
    DeactivateServiceHandler,
    GetServiceByIdHandler,
    SearchServicesHandler,
  ],
  exports: [IServiceReadPort],
})
export class ServiceModule {}
