import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Called after a user signs up via email
   * Emits user.created event for Paystack customer and wallet creation
   */
  async handleSignUpComplete(email: string) {
    // Get the newly created user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found after sign up');
    }

    // Emit user.created event
    this.eventEmitter.emit('user.created', {
      userId: user.id,
      email: user.email,
      firstName: user.name?.split(' ')[0],
      lastName: user.name?.split(' ').slice(1).join(' '),
      phone: user.phoneNumber,
    });

    return user;
  }
}
