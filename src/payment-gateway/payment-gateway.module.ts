import { PaymentGatewayErrorClassifier } from '@module/payments';
import { Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [PaymentGatewayErrorClassifier],
  exports: [PaymentGatewayErrorClassifier],
})
export class PaymentGatewayModule {}
