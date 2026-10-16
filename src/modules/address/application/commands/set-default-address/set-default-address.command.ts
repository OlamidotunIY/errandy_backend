import { UserId } from '@module/user';

export class SetDefaultAddressCommand {
  constructor(
    public readonly payload: {
      addressId: string;
      userId: UserId;
    },
  ) {}
}
