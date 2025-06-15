import { Test, TestingModule } from '@nestjs/testing';
import { CybersourceService } from './cybersource.service';

describe('CybersourceService', () => {
  let service: CybersourceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CybersourceService],
    }).compile();

    service = module.get<CybersourceService>(CybersourceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
