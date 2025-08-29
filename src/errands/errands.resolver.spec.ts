import { Test, TestingModule } from '@nestjs/testing';
import { ErrandsResolver } from './errands.resolver';
import { ErrandsService } from './errands.service';

describe('ErrandsResolver', () => {
  let resolver: ErrandsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrandsResolver, ErrandsService],
    }).compile();

    resolver = module.get<ErrandsResolver>(ErrandsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
