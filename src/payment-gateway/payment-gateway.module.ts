import { Module } from '@nestjs/common';
import { PaymentGatewayErrorClassifier } from '@payments/domain';

@Module({
  controllers: [],
  providers: [PaymentGatewayErrorClassifier],
  exports: [PaymentGatewayErrorClassifier],
})
export class PaymentGatewayModule {}
