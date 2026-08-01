import { PartyId } from '@module/party';
import { UserId } from '@module/user';

export class Person {
  constructor(
    public readonly id: PartyId,
    public readonly userId: UserId,
  ) {}
}
