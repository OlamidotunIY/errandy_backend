import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { EscrowService } from './escrow.service';

@Module({
  imports: [PaymentGatewayModule],
  providers: [EscrowService, PrismaService],
  exports: [EscrowService],
})
export class EscrowModule {}

