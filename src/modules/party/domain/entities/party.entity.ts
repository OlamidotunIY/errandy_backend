import { AggregateRoot } from '@src/common';
import {
  Organization,
  PartyId,
  PartyKind,
  Person,
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
    party._kind = PartyKind.ORGANIZATION;
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
    if (this._providerRole) {
      throw new ProviderRoleAlreadyExistsError(this.id.value);
    }

    this._providerRole = new ProviderRole(this.id);
    this.updatedAt = new Date();
  }

  deactivate() {
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
