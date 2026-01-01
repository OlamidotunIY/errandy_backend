import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGatewayResolver } from './payment-gateway.resolver';

describe('PaymentGatewayResolver', () => {
  let resolver: PaymentGatewayResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentGatewayResolver],
    }).compile();

    resolver = module.get<PaymentGatewayResolver>(PaymentGatewayResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
