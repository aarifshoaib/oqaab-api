import { Test, TestingModule } from '@nestjs/testing';
import { CybersourceController } from './cybersource.controller';

describe('CybersourceController', () => {
  let controller: CybersourceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CybersourceController],
    }).compile();

    controller = module.get<CybersourceController>(CybersourceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
