import { Module } from '@nestjs/common';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [],
  providers: [PaymentGatewayFactory, PrismaService],
  exports: [],
})
export class PaymentGatewayModule {}
