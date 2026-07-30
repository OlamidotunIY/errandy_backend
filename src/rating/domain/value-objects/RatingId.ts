import { EntityId } from '@src/common';

class RatingId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): RatingId {
    return new RatingId(crypto.randomUUID());
  }

  static fromString(value: string): RatingId {
    return new RatingId(value);
  }
}
export { RatingId };
