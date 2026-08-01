import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Address, AddressId } from '@module/address';

export class AddressUpdatedEvent extends BaseDomainEvent<AddressId> {
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
      eventName: AddressUpdatedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    address: Address,
    correlationId: string,
  ): AddressUpdatedEvent {
    return new AddressUpdatedEvent(address.id, new Date(), correlationId, {
      ownerUserId: address.ownerUserId,
    });
  }
}
