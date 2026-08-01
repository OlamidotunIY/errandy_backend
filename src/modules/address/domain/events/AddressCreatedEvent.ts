import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Address, AddressId } from '@module/address';

export class AddressCreatedEvent extends BaseDomainEvent<AddressId> {
  constructor(
    aggregateId: AddressId,
    occurredAt: Date,
    correlationId: string,
    payload: DomainEventPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: AddressCreatedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    address: Address,
    correlationId: string,
  ): AddressCreatedEvent {
    return new AddressCreatedEvent(address.id, new Date(), correlationId, {
      ownerUserId: address.ownerUserId,
    });
  }
}
