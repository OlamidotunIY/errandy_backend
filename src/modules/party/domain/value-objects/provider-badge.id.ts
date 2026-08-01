import { EntityId } from '@src/common';

export class ProviderBadgeId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ProviderBadgeId {
    return new ProviderBadgeId(crypto.randomUUID());
  }

  static fromString(value: string): ProviderBadgeId {
    return new ProviderBadgeId(value);
  }
}
