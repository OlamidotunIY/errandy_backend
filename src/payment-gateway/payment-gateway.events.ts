import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentGatewayService } from './payment-gateway.service';
import { PrismaService } from '../prisma.service';
import {
  globalEventEmitter,
  UserCreatedEvent,
  UserUpdatedEvent,
} from '../utils/event-emitter.utils';

@Injectable()
export class PaymentGatewayEventListener implements OnModuleInit {
  private readonly logger = new Logger(PaymentGatewayEventListener.name);

  constructor(
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Bridge global event emitter to NestJS EventEmitter2
   * This allows events from better-auth callbacks to reach NestJS listeners
   */
  onModuleInit() {
    // Forward global events to NestJS event system
    globalEventEmitter.on('user.created', (payload: UserCreatedEvent) => {
      this.eventEmitter.emit('user.created', payload);
    });

    globalEventEmitter.on('user.updated', (payload: UserUpdatedEvent) => {
      this.eventEmitter.emit('user.updated', payload);
    });

    this.logger.log(
      'PaymentGatewayEventListener initialized - bridged global events',
    );
  }

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
   * When a user is updated (firstName, lastName, or phone):
   * 1. Update Paystack customer info
   * 2. Create dedicated virtual bank account (only when phone is updated)
   */
  @OnEvent('user.updated')
  async handleUserUpdated(payload: UserUpdatedEvent) {
    this.logger.log(`User updated event received for user ${payload.userId}`);

    // Update Paystack customer with any changed fields
    if (payload.firstName || payload.lastName || payload.phone) {
      try {
        const customer =
          await this.paymentGatewayService.updatePaystackCustomer(
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

    // Create dedicated virtual bank account ONLY when phone is updated
    if (payload.phone) {
      try {
        const dedicatedAccount =
          await this.paymentGatewayService.createDedicatedAccount(
            payload.userId,
          );

        this.logger.log(
          `Dedicated account created for user ${payload.userId}: ${dedicatedAccount.account_number} (${dedicatedAccount.bank.name})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create dedicated account for user ${payload.userId}: ${error.message}`,
        );
      }
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
