import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  DeactivateServiceHandler,
  GetServiceByIdHandler,
  IServiceRepository,
  ListServiceHandler,
  SearchServicesHandler,
  ServiceMapper,
  ServiceResolver,
  ServiceRepository,
  UpdateServicePriceHandler,
} from '@module/service';

@Module({
  imports: [CqrsModule],
  providers: [
    ServiceMapper,
    ServiceResolver,
    {
      provide: IServiceRepository,
      useClass: ServiceRepository,
    },
    ListServiceHandler,
    UpdateServicePriceHandler,
    DeactivateServiceHandler,
    GetServiceByIdHandler,
    SearchServicesHandler,
  ],
  exports: [IServiceRepository],
})
export class ServiceModule {}
