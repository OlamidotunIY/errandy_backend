import { AggregateRoot } from '@src/common';
import {
  AddressCreatedEvent,
  AddressId,
  DefaultAddressChangedEvent,
} from '../';
import { UserId } from '@module/user';

export class Address extends AggregateRoot<AddressId> {
  constructor(
    public readonly id: AddressId,
    public readonly ownerUserId: UserId,
    private _label: string,
    private _street: string,
    private _city: string,
    private _state: string,
    private _country: string,
    private _isDefault: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  get label(): string {
    return this._label;
  }

  get street(): string {
    return this._street;
  }

  get city(): string {
    return this._city;
  }

  get state(): string {
    return this._state;
  }

  get country(): string {
    return this._country;
  }

  get isDefault(): boolean {
    return this._isDefault;
  }

  static create(
    userId: UserId,
    label: string,
    street: string,
    city: string,
    state: string,
    country: string,
  ): Address {
    const id = AddressId.create();
    const newAddress = new Address(
      id,
      userId,
      label,
      street,
      city,
      state,
      country,
      false,
      new Date(),
      new Date(),
    );

    newAddress.addDomainEvent(
      AddressCreatedEvent.fromAggregate(newAddress, crypto.randomUUID()),
    );

    return newAddress;
  }

  static reconstitute(props: {
    id: AddressId;
    userId: UserId;
    label: string;
    street: string;
    city: string;
    state: string;
    country: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Address {
    return new Address(
      props.id,
      props.userId,
      props.label,
      props.street,
      props.city,
      props.state,
      props.country,
      props.isDefault,
      props.createdAt,
      props.updatedAt,
    );
  }

  setAsDefault(): void {
    this._isDefault = true;

    this.addDomainEvent(
      DefaultAddressChangedEvent.fromAggregate(this, crypto.randomUUID()),
    );
  }

  unsetDefault(): void {
    this._isDefault = false;
  }
}
