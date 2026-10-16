import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PartyModule } from '@module/party/party.module';
import { UserModule } from '@module/user/user.module';
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
  imports: [CqrsModule, PartyModule, UserModule],
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
