import { Test, TestingModule } from '@nestjs/testing';
import { OrderlyService } from './orderly.service';

describe('OrderlyService', () => {
  let service: OrderlyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderlyService],
    }).compile();

    service = module.get<OrderlyService>(OrderlyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
