import { EntityId } from '@src/common';

export class PartyId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): PartyId {
    return new PartyId(crypto.randomUUID());
  }

  static fromString(value: string): PartyId {
    return new PartyId(value);
  }
}
