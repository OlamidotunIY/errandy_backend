import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  PaymentGatewayAdapter,
  PaymentMapper,
  PrismaPaymentMethodRepository,
  PrismaPaymentTransactionRepository,
} from './infrastructure';
import {
  IPaymentGatewayAdapter,
  IPaymentMethodRepository,
  IPaymentTransactionRepository,
} from './domain';
import { InitiateChargeHandler } from './application';
import { PaymentWebhookController } from './presentation';

@Module({
  imports: [CqrsModule],
  controllers: [PaymentWebhookController],
  providers: [
    PaymentMapper,
    {
      provide: IPaymentGatewayAdapter,
      useClass: PaymentGatewayAdapter,
    },
    {
      provide: IPaymentMethodRepository,
      useClass: PrismaPaymentMethodRepository,
    },
    {
      provide: IPaymentTransactionRepository,
      useClass: PrismaPaymentTransactionRepository,
    },
    InitiateChargeHandler,
  ],
  exports: [
    IPaymentGatewayAdapter,
    IPaymentMethodRepository,
    IPaymentTransactionRepository,
    PaymentMapper,
  ],
})
export class PaymentsModule {}
