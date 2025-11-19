import { Test, TestingModule } from '@nestjs/testing';
import { ChangeNowController } from './change-now.controller';

describe('ChangeNowController', () => {
  let controller: ChangeNowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeNowController],
    }).compile();

    controller = module.get<ChangeNowController>(ChangeNowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
