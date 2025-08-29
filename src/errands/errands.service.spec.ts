import { Test, TestingModule } from '@nestjs/testing';
import { ErrandsService } from './errands.service';

describe('ErrandsService', () => {
  let service: ErrandsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrandsService],
    }).compile();

    service = module.get<ErrandsService>(ErrandsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
