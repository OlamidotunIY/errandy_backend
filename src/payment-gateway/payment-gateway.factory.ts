import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './interfaces/payment-gateway.interface';

@Injectable()
export class PaymentGatewayFactory {
  constructor() {}

  // getGateway(provider: string): PaymentGateway {
  //   switch (provider.toLowerCase()) {
  //     case 'paystack':
  //       return this.paystackGateway;
  //     default:
  //       throw new Error(`Unsupported payment provider: ${provider}`);
  //   }
  // }
}
