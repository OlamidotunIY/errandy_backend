import { EntityId } from '@src/common';

export class OrganizationMemberId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): OrganizationMemberId {
    return new OrganizationMemberId(crypto.randomUUID());
  }

  static fromString(value: string): OrganizationMemberId {
    return new OrganizationMemberId(value);
  }
}
