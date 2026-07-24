import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports: [PaymentGatewayModule],
  providers: [PrismaService],
  exports: [],
})
export class EscrowModule {}
