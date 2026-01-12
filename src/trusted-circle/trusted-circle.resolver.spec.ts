import { Test, TestingModule } from '@nestjs/testing';
import { TrustedCircleResolver } from './trusted-circle.resolver';

describe('TrustedCircleResolver', () => {
  let resolver: TrustedCircleResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedCircleResolver],
    }).compile();

    resolver = module.get<TrustedCircleResolver>(TrustedCircleResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
