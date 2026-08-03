import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Address, AddressId } from '@module/address';

export class DefaultAddressChangedEvent extends BaseDomainEvent<AddressId> {
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
      eventName: DefaultAddressChangedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    address: Address,
    correlationId: string,
  ): DefaultAddressChangedEvent {
    return new DefaultAddressChangedEvent(
      address.id,
      new Date(),
      correlationId,
      {
        ownerUserId: address.ownerUserId,
      },
    );
  }
}
