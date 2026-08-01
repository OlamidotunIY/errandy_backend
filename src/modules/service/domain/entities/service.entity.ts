import { AggregateRoot } from '@src/common';
import { Money } from '@module/escrow/domain';
import { ServiceId } from '../value-objects';
import { ServiceListedEvent, ServiceDeactivatedEvent } from '../events';

interface ServiceProps {
  id: ServiceId;
  listedById: string;
  categoryId: string;
  marketId: string;
  title: string;
  description: string;
  price: Money;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Service extends AggregateRoot<ServiceId> {
  private _title: string;
  private _description: string;
  private _price: Money;
  private _isActive: boolean;

  private constructor(private readonly props: ServiceProps) {
    super(props.id);
    this._title = props.title;
    this._description = props.description;
    this._price = props.price;
    this._isActive = props.isActive;
  }

  static create(
    listedById: string,
    categoryId: string,
    marketId: string,
    title: string,
    description: string,
    price: Money,
  ): Service {
    const service = new Service({
      id: ServiceId.create(),
      listedById,
      categoryId,
      marketId,
      title,
      description,
      price,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    service.addDomainEvent(
      ServiceListedEvent.fromAggregate(service, crypto.randomUUID()),
    );

    return service;
  }

  static reconstitute(props: ServiceProps): Service {
    return new Service(props);
  }

  get listedById(): string {
    return this.props.listedById;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get marketId(): string {
    return this.props.marketId;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get price(): Money {
    return this._price;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updatePrice(newPrice: Money): void {
    this._price = newPrice;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      ServiceDeactivatedEvent.fromAggregate(this, crypto.randomUUID()),
    );
  }
}
