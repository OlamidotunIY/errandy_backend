import { EntityId } from '@src/common';

class ErrandAssignmentId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ErrandAssignmentId {
    return new ErrandAssignmentId(crypto.randomUUID());
  }

  static fromString(value: string): ErrandAssignmentId {
    return new ErrandAssignmentId(value);
  }
}

export { ErrandAssignmentId };
