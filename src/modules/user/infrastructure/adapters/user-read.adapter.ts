import { Injectable } from '@nestjs/common';
import { IUserReadPort, UserSnapshot } from '@src/common';
import { IUserRepository } from '../../domain';

@Injectable()
export class UserReadAdapter extends IUserReadPort {
  constructor(private readonly userRepository: IUserRepository) {
    super();
  }

  async findById(userId: string): Promise<UserSnapshot | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return {
      id: userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
    };
  }
}
