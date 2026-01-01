import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentGatewayResolver } from './payment-gateway.resolver';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PaystackGateway } from './gateways/paystack.gateway';
import { PrismaService } from '../prisma.service';

import { PaymentGatewayController } from './payment-gateway.controller';

@Module({
  controllers: [PaymentGatewayController],
  providers: [
    PaymentGatewayService,
    PaymentGatewayResolver,
    PaymentGatewayFactory,
    PaystackGateway,
    PrismaService,
  ],
})
export class PaymentGatewayModule {}
