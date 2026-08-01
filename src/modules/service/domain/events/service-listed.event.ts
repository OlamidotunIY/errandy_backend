import { BaseDomainEvent } from '@src/common';
import { Service } from '../entities';
import { ServiceId } from '../value-objects';

interface ServiceListedPayload {
  serviceId: string;
  listedById: string;
  categoryId: string;
}

export class ServiceListedEvent extends BaseDomainEvent<
  ServiceId,
  ServiceListedPayload
> {
  constructor(
    aggregateId: ServiceId,
    correlationId: string | undefined,
    payload: ServiceListedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: ServiceListedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    service: Service,
    correlationId?: string,
  ): ServiceListedEvent {
    return new ServiceListedEvent(service.id, correlationId, {
      serviceId: service.id.value,
      listedById: service.listedById,
      categoryId: service.categoryId,
    });
  }
}
