import { Test, TestingModule } from '@nestjs/testing';
import { ChangeNowService } from './change-now.service';

describe('ChangeNowService', () => {
  let service: ChangeNowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangeNowService],
    }).compile();

    service = module.get<ChangeNowService>(ChangeNowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
