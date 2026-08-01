import { BaseDomainEvent } from '@src/common';
import { Service } from '../entities';
import { ServiceId } from '../value-objects';

interface ServiceDeactivatedPayload {
  serviceId: string;
}

export class ServiceDeactivatedEvent extends BaseDomainEvent<
  ServiceId,
  ServiceDeactivatedPayload
> {
  constructor(
    aggregateId: ServiceId,
    correlationId: string | undefined,
    payload: ServiceDeactivatedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: ServiceDeactivatedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    service: Service,
    correlationId?: string,
  ): ServiceDeactivatedEvent {
    return new ServiceDeactivatedEvent(service.id, correlationId, {
      serviceId: service.id.value,
    });
  }
}
