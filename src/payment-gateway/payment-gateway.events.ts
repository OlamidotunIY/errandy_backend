import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentGatewayService } from './payment-gateway.service';
import { PrismaService } from '../prisma.service';

// Event payload types
export interface UserCreatedEvent {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UserUpdatedEvent {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Injectable()
export class PaymentGatewayEventListener {
  private readonly logger = new Logger(PaymentGatewayEventListener.name);

  constructor(
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * When a user is created:
   * 1. Create Paystack customer
   * 2. Create wallet(s) based on their profiles
   */
  @OnEvent('user.created')
  async handleUserCreated(payload: UserCreatedEvent) {
    this.logger.log(`User created event received for user ${payload.userId}`);

    // Create Paystack customer
    try {
      const customer = await this.paymentGatewayService.createPaystackCustomer(
        payload.userId,
        {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
        },
      );

      this.logger.log(
        `Paystack customer created for user ${payload.userId}: ${customer.customer_code}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create Paystack customer for user ${payload.userId}: ${error.message}`,
      );
    }

    // Get user profiles to create appropriate wallets
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { client: true, provider: true },
      });

      // Create wallet for client profile
      if (user?.client) {
        await this.createWallet(user.client.id, 'CLIENT');
        this.logger.log(`Wallet created for client ${user.client.id}`);
      }

      // Create wallet for provider profile
      if (user?.provider) {
        await this.createWallet(user.provider.id, 'WORKER');
        this.logger.log(`Wallet created for provider ${user.provider.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create wallet for user ${payload.userId}: ${error.message}`,
      );
    }
  }

  /**
   * When a user is updated, update their Paystack customer info
   */
  @OnEvent('user.updated')
  async handleUserUpdated(payload: UserUpdatedEvent) {
    this.logger.log(`User updated event received for user ${payload.userId}`);

    try {
      if (!payload.firstName && !payload.lastName && !payload.phone) {
        return;
      }

      const customer = await this.paymentGatewayService.updatePaystackCustomer(
        payload.userId,
        {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
        },
      );

      this.logger.log(
        `Paystack customer updated for user ${payload.userId}: ${customer.customer_code}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Paystack customer for user ${payload.userId}: ${error.message}`,
      );
    }
  }

  /**
   * Create a wallet for a user profile
   */
  private async createWallet(ownerId: string, ownerType: 'CLIENT' | 'WORKER') {
    // Check if wallet already exists
    const existing = await this.prisma.wallet.findFirst({
      where: { ownerId, ownerType },
    });

    if (existing) {
      this.logger.log(`Wallet already exists for ${ownerType} ${ownerId}`);
      return existing;
    }

    return this.prisma.wallet.create({
      data: {
        ownerId,
        ownerType,
        available: 0,
        held: 0,
        currency: 'NGN',
      },
    });
  }
}
