import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import * as crypto from 'node:crypto';
import { Request } from 'express';
import { ILogger } from '@src/common';
import {
  IPaymentTransactionRepository,
  PaymentTransaction,
  ChargeSucceededEvent,
  ChargeFailedEvent,
} from '../../domain';

@Controller('webhooks/payment-gateway')
export class PaymentWebhookController {
  private readonly secretKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly transactionRepository: IPaymentTransactionRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') ?? '';
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ status: string }> {
    if (!signature || !this.secretKey) {
      throw new UnauthorizedException('Missing signature or secret key');
    }

    // Verify HMAC-SHA512 signature
    const payload = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(hash, 'utf-8');
    const actualBuffer = Buffer.from(signature, 'utf-8');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      this.logger.warn('Paystack webhook: invalid signature mismatch');
      throw new UnauthorizedException('Invalid signature');
    }

    const event = req.body;
    this.logger.info(`Paystack webhook received: ${event?.event}`, {
      event: event?.event,
      reference: event?.data?.reference,
    });

    const correlationId = crypto.randomUUID();

    switch (event?.event) {
      case 'charge.success': {
        const reference = event.data?.reference;
        if (!reference) break;

        const transaction =
          await this.transactionRepository.findByGatewayReference(reference);

        if (transaction && transaction.status === 'PENDING') {
          transaction.markSucceeded(reference, correlationId);
          await this.transactionRepository.save(transaction);

          for (const ev of transaction.pullDomainEvents()) {
            this.eventBus.publish(ev);
          }

          this.logger.info(`Transaction ${reference} marked succeeded via webhook`);
        }
        break;
      }

      case 'transfer.success': {
        this.logger.info(`Transfer succeeded: ${event.data?.reference}`);
        break;
      }

      case 'transfer.failed':
      case 'transfer.reversed': {
        this.logger.warn(
          `Transfer failed/reversed: ${event.data?.reference}`,
          { reason: event.data?.reason },
        );
        break;
      }

      default:
        this.logger.info(`Unhandled payment webhook event: ${event?.event}`);
    }

    return { status: 'success' };
  }
}
