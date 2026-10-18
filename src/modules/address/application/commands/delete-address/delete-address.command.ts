import { UserId } from '@module/user';

export class DeleteAddressCommand {
  constructor(
    public readonly payload: {
      addressId: string;
      userId: UserId;
    },
  ) {}
}
