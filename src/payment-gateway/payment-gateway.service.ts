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

  async getPaymentMethods(user: User) {
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return [];
    }

    return this.prisma.paymentMethod.findMany({
      where: { userId: client.id }, // paymentMethod.userId links to Client.id
      orderBy: { createdAt: 'desc' },
    });
  }

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

      // Trigger Refund - use transaction ID (not authorization_code which is for charging)
      try {
        await gateway.refundTransaction(
          response.data.id.toString(),
          response.data.amount,
        );
      } catch (refundError) {
        this.logger.error(
          `Failed to initiate refund for ${reference}: ${refundError.message}`,
        );

        // Fallback: Credit user's wallet instead of card refund
        try {
          const refundAmountKobo = Number(response.data.amount || 0);

          // Find or create wallet for this client
          let wallet = await this.prisma.wallet.findFirst({
            where: { ownerId: client.id, ownerType: 'CLIENT' },
          });

          if (!wallet) {
            wallet = await this.prisma.wallet.create({
              data: {
                ownerId: client.id,
                ownerType: 'CLIENT',
                available: 0,
                held: 0,
                currency: 'NGN',
              },
            });
          }

          // Credit wallet
          await this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { available: { increment: refundAmountKobo } },
          });

          // Create transaction record for audit
          await this.prisma.transaction.create({
            data: {
              ownerId: client.id,
              ownerType: 'CLIENT',
              amount: refundAmountKobo,
              type: 'FUND',
              status: 'SUCCESS',
              reference: `REFUND_FALLBACK_${reference}`,
              metadata: {
                originalReference: reference,
                reason: 'Paystack refund failed, credited to wallet',
                paystackError: refundError.message,
              },
            },
          });

          this.logger.log(
            `Credited ₦${refundAmountKobo / 100} to wallet for user ${client.id} (refund fallback)`,
          );
        } catch (walletError) {
          this.logger.error(
            `Failed to credit wallet for ${reference}: ${walletError.message}`,
          );
          // At this point, we've saved the card but couldn't refund or credit wallet.
          // This needs admin attention - could add alerting here.
        }
      }

      return paymentMethod;
    }

    throw new BadRequestException(
      `Payment verification failed: ${response.message || 'Unknown error'}`,
    );
  }

  /**
   * Create a Paystack customer for a user (client or provider)
   */
  async createPaystackCustomer(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if customer already exists
    const existingCustomer = await this.prisma.paystackCustomer.findUnique({
      where: { userId: userId },
    });

    if (existingCustomer) {
      // Customer already exists, return it instead of throwing
      this.logger.log(`Paystack customer already exists for user ${userId}`);
      return existingCustomer;
    }

    // Create customer in Paystack
    const gateway = this.paymentGatewayFactory.getGateway('paystack') as any;

    this.logger.log(`Creating Paystack customer for user ${userId}`);

    const response = await gateway.createCustomer(
      user.email,
      input.firstName || user.name?.split(' ')[0],
      input.lastName || user.name?.split(' ').slice(1).join(' '),
      input.phone || user.phoneNumber,
      { userId: userId },
    );

    if (!response.status) {
      throw new BadRequestException(
        `Failed to create Paystack customer: ${response.message || 'Unknown error'}`,
      );
    }

    // Save to database
    const paystackCustomer = await this.prisma.paystackCustomer.create({
      data: {
        customer_code: response.data.customer_code,
        customer_id: response.data.id.toString(),
        userId: userId,
      },
    });

    return {
      ...paystackCustomer,
      paystackData: response.data,
    };
  }

  /**
   * Update a Paystack customer
   */
  async updatePaystackCustomer(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    // Get existing customer record
    const existingCustomer = await this.prisma.paystackCustomer.findUnique({
      where: { userId: userId },
    });

    if (!existingCustomer) {
      throw new BadRequestException(
        'Paystack customer not found for this user',
      );
    }

    // Update in Paystack
    const gateway = this.paymentGatewayFactory.getGateway('paystack') as any;

    this.logger.log(`Updating Paystack customer for user ${userId}`);

    const response = await gateway.updateCustomer(
      existingCustomer.customer_code,
      input,
    );

    if (!response.status) {
      throw new BadRequestException(
        `Failed to update Paystack customer: ${response.message || 'Unknown error'}`,
      );
    }

    return {
      ...existingCustomer,
      paystackData: response.data,
    };
  }

  /**
   * Get Paystack customer for a user
   */
  async getPaystackCustomer(userId: string) {
    const existingCustomer = await this.prisma.paystackCustomer.findUnique({
      where: { userId: userId },
    });

    if (!existingCustomer) {
      return null;
    }

    // Optionally fetch latest data from Paystack
    try {
      const gateway = this.paymentGatewayFactory.getGateway('paystack') as any;
      const response = await gateway.fetchCustomer(
        existingCustomer.customer_code,
      );

      return {
        ...existingCustomer,
        paystackData: response.status ? response.data : null,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Paystack customer data: ${error.message}`,
      );
      return existingCustomer;
    }
  }

  /**
   * Create or get existing Paystack customer (idempotent)
   */
  async getOrCreatePaystackCustomer(
    userId: string,
    input?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    const existing = await this.getPaystackCustomer(userId);
    if (existing) {
      return existing;
    }
    return this.createPaystackCustomer(userId, input || {});
  }

  /**
   * Create a dedicated virtual bank account for a user
   * This allows the user to receive transfers via NUBAN
   */
  async createDedicatedAccount(
    userId: string,
    preferredBank: string = 'wema-bank',
  ) {
    // Get the Paystack customer for this user
    const paystackCustomer = await this.prisma.paystackCustomer.findUnique({
      where: { userId: userId },
    });

    if (!paystackCustomer) {
      throw new BadRequestException(
        'Paystack customer not found for this user. Create customer first.',
      );
    }

    const gateway = this.paymentGatewayFactory.getGateway('paystack') as any;

    this.logger.log(`Creating dedicated account for user ${userId}`);

    const response = await gateway.createDedicatedAccount(
      paystackCustomer.customer_id,
      preferredBank,
    );

    if (!response.status) {
      throw new BadRequestException(
        `Failed to create dedicated account: ${response.message || 'Unknown error'}`,
      );
    }

    this.logger.log(
      `Dedicated account created for user ${userId}: ${response.data.account_number}`,
    );

    return response.data;
  }

  /**
   * Charges a saved payment method (e.g. Paystack authorization_code).
   * The underlying gateway call must be idempotent for the provided key.
   */
  async chargeSavedPaymentMethod(
    user: User,
    paymentMethodId: string,
    amount: number, // in smallest currency unit (e.g. kobo)
    idempotencyKey: string,
    metadata?: any,
  ): Promise<{ paymentRef: string; raw: any }> {
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      throw new BadRequestException('User does not have a client profile');
    }

    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod || paymentMethod.userId !== client.id) {
      throw new BadRequestException('Invalid payment method');
    }

    if (!paymentMethod.verified) {
      throw new BadRequestException('Payment method is not verified');
    }

    const gateway = this.paymentGatewayFactory.getGateway(paymentMethod.provider);

    this.logger.log(
      `Charging client ${client.id} via ${paymentMethod.provider} (idempotencyKey=${idempotencyKey})`,
    );

    const result = await gateway.charge(
      user.email,
      amount,
      paymentMethod.providerRef,
      idempotencyKey,
      metadata,
    );

    const paymentRef =
      result?.data?.reference ||
      result?.reference ||
      result?.data?.id?.toString?.();

    if (!paymentRef) {
      throw new BadRequestException('Payment gateway did not return a reference');
    }

    // Paystack-style: { status: true, data: { status: "success" } }
    if (result?.status === false) {
      throw new BadRequestException(result?.message || 'Charge failed');
    }

    const gatewayStatus: string | undefined = result?.data?.status;
    if (
      gatewayStatus &&
      !['success', 'successful'].includes(gatewayStatus.toLowerCase())
    ) {
      throw new BadRequestException(
        `Charge not successful (status=${gatewayStatus})`,
      );
    }

    return { paymentRef, raw: result };
  }

  /**
   * Initialize wallet funding via card, transfer, or QR
   */
  async initializeWalletFunding(
    user: User,
    amount: number, // in kobo
    channel: 'card' | 'transfer' | 'qr',
  ) {
    // Get or create client profile
    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      throw new BadRequestException('User does not have a client profile');
    }

    const metadata = {
      type: 'WALLET_FUNDING',
      userId: user.id,
      clientId: client.id,
      channel,
    };

    const gateway = this.paymentGatewayFactory.getGateway('paystack') as any;

    this.logger.log(
      `Initializing wallet funding for user ${user.id} via ${channel}`,
    );

    if (channel === 'card') {
      // Use existing transaction initialization for card
      const callbackUrl =
        process.env.WALLET_CALLBACK_URL ||
        'https://errandy.app/wallet/callback';

      const result = await gateway.initializeTransaction(
        user.email,
        amount,
        callbackUrl,
        metadata,
      );

      return {
        status: result.status,
        message: result.message || 'Authorization URL generated',
        reference: result.data?.reference,
        channel: 'card',
        amount,
        authorizationUrl: result.data?.authorization_url,
      };
    }

    if (channel === 'transfer') {
      // Use bank transfer charge
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 min expiry

      const result = await gateway.chargeWithTransfer(
        user.email,
        amount,
        expiresAt,
        metadata,
      );

      // Paystack returns pending status with bank details
      if (
        result.data?.status === 'pending' ||
        result.data?.status === 'send_transfer'
      ) {
        return {
          status: true,
          message: result.message || 'Transfer pending',
          reference: result.data?.reference,
          channel: 'transfer',
          amount,
          bankDetails: {
            accountNumber: result.data?.bank_transfer?.account_number,
            accountName: result.data?.bank_transfer?.account_name,
            bankName: result.data?.bank_transfer?.bank,
            expiresAt: result.data?.bank_transfer?.account_expires_at,
          },
        };
      }

      return {
        status: result.status,
        message: result.message || 'Transfer charge created',
        reference: result.data?.reference,
        channel: 'transfer',
        amount,
      };
    }

    if (channel === 'qr') {
      // Use QR charge
      const result = await gateway.chargeWithQR(user.email, amount, metadata);

      return {
        status: result.status,
        message: result.message || 'QR code generated',
        reference: result.data?.reference,
        channel: 'qr',
        amount,
        qrDetails: {
          qrCode: result.data?.display_text || result.data?.qr_code,
          displayText: result.data?.display_text,
        },
      };
    }

    throw new BadRequestException(`Invalid payment channel: ${channel}`);
  }
}
