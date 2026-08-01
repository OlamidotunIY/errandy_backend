import { AggregateRoot } from '@src/common';
import {
  Organization,
  PartyId,
  PartyKind,
  Person,
  ProviderRole,
} from '@module/party';
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

  static createPerson(userId: UserId, marketId: string): Party {
    const party = this.create(marketId);
    party._person = new Person(party.id, userId);
    return party;
  }

  static createOrganization(
    ownerId: UserId,
    name: string,
    businessRegistrationNumber: string,
    marketId: string,
  ): Party {
    const party = this.create(marketId);
    party._organization = new Organization(
      party.id,
      name,
      businessRegistrationNumber,
      ownerId,
      new Date(),
      new Date(),
    );

    return party;
  }

  addProviderRole(): void {
    if (this._providerRole) return;

    this._providerRole = new ProviderRole(this.id);
    this.updatedAt = new Date();
  }
