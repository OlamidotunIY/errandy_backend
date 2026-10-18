import { UserId } from '@module/user';

export class GetUserAddressesQuery {
  constructor(public readonly userId: UserId) {}
}
