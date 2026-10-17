import { PartyId } from '../value-objects';
import { UserId } from '@module/user';

export class Person {
  constructor(
    public readonly id: PartyId,
    public readonly userId: UserId,
  ) {}
}
