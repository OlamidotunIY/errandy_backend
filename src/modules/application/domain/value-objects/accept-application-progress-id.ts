import { EntityId } from '@src/common';

export class AcceptApplicationProgressId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): AcceptApplicationProgressId {
    return new AcceptApplicationProgressId(crypto.randomUUID());
  }

  static fromString(value: string): AcceptApplicationProgressId {
    return new AcceptApplicationProgressId(value);
  }
}
