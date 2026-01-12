import { Test, TestingModule } from '@nestjs/testing';
import { TrustedCircleService } from './trusted-circle.service';

describe('TrustedCircleService', () => {
  let service: TrustedCircleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedCircleService],
    }).compile();

    service = module.get<TrustedCircleService>(TrustedCircleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
