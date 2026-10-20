
import { Test, TestingModule } from '@nestjs/testing';

import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;

  const customersServiceMock = {};

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [CustomersController],
        providers: [
          {
            provide: CustomersService,
            useValue: customersServiceMock,
          },
        ],
      }).compile();

    controller =
      module.get<CustomersController>(CustomersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
