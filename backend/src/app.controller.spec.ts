
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the NEXA API status', () => {
      expect(appController.getStatus()).toEqual({
        success: true,
        message: 'NEXA API is running',
        version: '1.0.0',
      });
    });
  });
});