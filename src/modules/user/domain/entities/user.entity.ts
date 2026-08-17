import { AggregateRoot } from '@src/common';
import { UserId } from '../';

export class User extends AggregateRoot<UserId> {
  constructor(
    id: UserId,
    public readonly name: string,
    public readonly email: string,
    public readonly emailVerified: boolean,
    public readonly image: string | null,
    public readonly phoneNumber: string | null,
    public readonly phoneNumberVerified: boolean | null,
    public readonly username: string | null,
    public readonly displayUsername: string | null,
    public readonly twoFactorEnabled: boolean | null,
    public readonly activeAddressId: string | null,
    public readonly chatRoomIds: string[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }
}
