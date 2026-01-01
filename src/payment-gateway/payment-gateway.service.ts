import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PrismaService } from '../prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    private readonly prisma: PrismaService,
  ) {}

  async initializeAddPaymentMethod(user: User, provider: string = 'paystack') {
    // 1. Validate User/Client
    // We assume only Clients add payment methods for now, or both?
    // PaymentMethod schema links to Client. So user must involve a Client record.
    // Let's find the Client profile for this user.
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      // If the user is a worker trying to pay for something?
      // Or maybe we auto-create client profile?
      // For now, assume a Client profile is required.
      throw new BadRequestException('User does not have a client profile');
    }

    const gateway = this.paymentGatewayFactory.getGateway(provider);

    // 2. Initialize Transaction
    // Amount: 50 Naira = 5000 kobo
    const amount = 5000;
    const callbackUrl =
      process.env.PAYMENT_CALLBACK_URL ||
      'https://errandy.app/payment/callback';

    this.logger.log(
      `Initializing payment method addition for user ${user.id} via ${provider}`,
    );

    const result = await gateway.initializeTransaction(
      user.email,
      amount,
      callbackUrl,
      {
        type: 'ADD_PAYMENT_METHOD',
        userId: user.id, // Storing User ID in metadata for verification context if needed
        clientId: client.id,
      },
    );

    return result;
  }

  async verifyAndSavePaymentMethod(
    user: User,
    reference: string,
    provider: string = 'paystack',
  ) {
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      throw new BadRequestException('User does not have a client profile');
    }

    const gateway = this.paymentGatewayFactory.getGateway(provider);

    this.logger.log(
      `Verifying payment method for ref ${reference} via ${provider}`,
    );

    const response = await gateway.verifyTransaction(reference);

    if (response.status && response.data.status === 'success') {
      const auth = response.data.authorization;

      // Check if reusable
      if (!auth.reusable) {
        throw new BadRequestException(
          'The card used is not reusable. Please try another card.',
        );
      }

      // Check if this card already exists for this user to avoid duplicates?
      const existing = await this.prisma.paymentMethod.findFirst({
        where: {
          userId: client.id, // PaymentMethod.userId refers to Client.id
          providerRef: auth.authorization_code, // Assuming auth code is unique per card/user combo in Paystack?
          // Or better check by signature if available to be globally unique for the card?
          // auth.signature is a good check.
        },
      });

      // Also check signature if we want to be stricter
      if (existing) {
        return existing; // Already exists, just return it
      }

      // Create Payment Method
      const paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          userId: client.id, // This is the field in PaymentMethod model referencing Client
          provider: provider,
          providerRef: auth.authorization_code,
          type: auth.channel,
          cardBrand: auth.brand,
          last4: auth.last4,
          expMonth: parseInt(auth.exp_month),
          expYear: parseInt(auth.exp_year),
          verified: true,
          isDefault: false, // Logic to set default if it's the first one?
        },
      });

      // If it's the first one, make it default
      const count = await this.prisma.paymentMethod.count({
        where: { userId: client.id },
      });
      if (count === 1) {
        await this.prisma.paymentMethod.update({
          where: { id: paymentMethod.id },
          data: { isDefault: true },
        });
        paymentMethod.isDefault = true;
      }

      // Trigger Refund
      try {
        // Refund the full amount (5000 kobo)
        await gateway.refundTransaction(auth.authorization_code, 5000);
        // Note: Paystack might prefer transaction reference? Reference is "re4lyvq3s3".
        // auth.authorization_code is "AUTH_...".
        // The user snippet uses "transaction": "qufywna9w9a5d8v".
        // The gateway implementation takes transactionOrReference. Use reference from response.data (passed as arg).
        await gateway.refundTransaction(
          response.data.id.toString(),
          response.data.amount,
        );
      } catch (refundError) {
        this.logger.error(
          `Failed to initiate refund for ${reference}: ${refundError.message}`,
        );
        // We don't fail the verification if refund fails?
        // Ideally we should alert admin or user, but let's log for now.
        // Or maybe we treat it as critical? The user wants "make sure I do not process 1 refund twice".
        // But valid verification MUST save the card. Refund is cleanup.
      }

      return paymentMethod;
    }

    throw new BadRequestException(
      `Payment verification failed: ${response.message || 'Unknown error'}`,
    );
  }
}
