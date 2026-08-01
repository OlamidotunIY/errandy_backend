import { DomainEvent } from '@src/common';
import { Address, AddressId } from '@module/address';

export class AddressUpdatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: AddressId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    aggregateId: AddressId,
    occurredAt: Date,
    correlationId: string,
    public readonly payload: Record<string, unknown>,
  ) {
    this.eventName = 'AddressUpdatedEvent';
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = aggregateId;
    this.correlationId = correlationId;
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
