import { AggregateRoot } from '@src/common';
import {
  Organization,
  OrgMemberRole,
  OrganizationMemberAddedEvent,
  OrganizationMemberRemovedEvent,
  OrganizationNotFoundError,
  PartyId,
  PartyKind,
  PartyCreatedEvent,
  PartyDeactivatedEvent,
  Person,
  ProviderRoleAddedEvent,
  ProviderRole,
} from '@module/party';
import { ProviderRoleAlreadyExistsError } from '../errors';
import { UserId } from '@module/user';

export class Party extends AggregateRoot<PartyId> {
  constructor(
    public readonly id: PartyId,
    private _kind: PartyKind,
    private readonly _marketId: string,
    private _isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,

    private _person?: Person | null,
    private _organization?: Organization | null,
    private _providerRole?: ProviderRole | null,
  ) {
    super(id);
  }

  private static create(marketId: string): Party {
    const id = PartyId.create();
    return new Party(
      id,
      PartyKind.PERSON,
      marketId,
      true,
      new Date(),
      new Date(),
    );
  }

  static createPerson(
    userId: UserId,
    marketId: string,
    correlationId?: string,
  ): Party {
    const party = this.create(marketId);
    party._person = new Person(party.id, userId);
    party.addDomainEvent(PartyCreatedEvent.fromAggregate(party, correlationId));
    return party;
  }

  static createOrganization(
    ownerId: UserId,
    name: string,
    businessRegistrationNumber: string,
    marketId: string,
    correlationId?: string,
  ): Party {
    const party = this.create(marketId);
    party._kind = PartyKind.ORGANIZATION;
    party._organization = new Organization(
      party.id,
      name,
      businessRegistrationNumber,
      ownerId,
      new Date(),
      new Date(),
    );
    party.addDomainEvent(PartyCreatedEvent.fromAggregate(party, correlationId));

    return party;
  }

  addProviderRole(correlationId?: string): void {
    if (this._providerRole) {
      throw new ProviderRoleAlreadyExistsError(this.id.value);
    }

    this._providerRole = new ProviderRole(this.id);
    this.updatedAt = new Date();
    this.addDomainEvent(
      ProviderRoleAddedEvent.fromAggregate(this, correlationId),
    );
  }

  deactivate(correlationId?: string) {
    this._isActive = false;
    if (this._providerRole) {
      // preserve original createdAt if available, set provider role as inactive and update timestamp
      const createdAt = this._providerRole.createdAt ?? new Date();
      this._providerRole = new ProviderRole(
        this.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        createdAt,
        new Date(),
      );
    }

    this.updatedAt = new Date();
    this.addDomainEvent(
      PartyDeactivatedEvent.fromAggregate(this, correlationId),
    );
  }

  addOrganizationMember(
    userId: UserId,
    role: OrgMemberRole,
    correlationId?: string,
  ): void {
    if (!this._organization) {
      throw new OrganizationNotFoundError(this.id.value);
    }

    this._organization.addMember(userId, role);
    this.updatedAt = new Date();
    this.addDomainEvent(
      OrganizationMemberAddedEvent.create(this.id, userId.value, correlationId),
    );
  }

  removeOrganizationMember(userId: UserId, correlationId?: string): void {
    if (!this._organization) {
      throw new OrganizationNotFoundError(this.id.value);
    }

    this._organization.removeMember(userId);
    this.updatedAt = new Date();
    this.addDomainEvent(
      OrganizationMemberRemovedEvent.create(
        this.id,
        userId.value,
        correlationId,
      ),
    );
  }

  get kind(): PartyKind {
    return this._kind;
  }

  get marketId(): string {
    return this._marketId;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get person(): Person | null | undefined {
    return this._person;
  }

  get organization(): Organization | null | undefined {
    return this._organization;
  }

  get providerRole(): ProviderRole | null | undefined {
    return this._providerRole;
  }
}
