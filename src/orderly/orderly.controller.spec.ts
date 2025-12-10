import { Test, TestingModule } from '@nestjs/testing';
import { OrderlyController } from './orderly.controller';
import { OrderlyService } from './orderly.service';

describe('OrderlyController', () => {
  let controller: OrderlyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderlyController],
      providers: [OrderlyService],
    }).compile();

    controller = module.get<OrderlyController>(OrderlyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
