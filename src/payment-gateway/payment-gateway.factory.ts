import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './interfaces/payment-gateway.interface';
import { PaystackGateway } from './gateways/paystack.gateway';

@Injectable()
export class PaymentGatewayFactory {
  constructor(private readonly paystackGateway: PaystackGateway) {}

  getGateway(provider: string): PaymentGateway {
    switch (provider.toLowerCase()) {
      case 'paystack':
        return this.paystackGateway;
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}
