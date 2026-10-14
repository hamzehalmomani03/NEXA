
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: authServiceMock,
          },
        ],
      })
        .overrideGuard(ThrottlerGuard)
        .useValue({
          canActivate: jest.fn().mockReturnValue(true),
        })
        .compile();

    controller =
      module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should apply ThrottlerGuard to the login route', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.login,
    ) as Array<{ name?: string }>;

    expect(guards).toBeDefined();
    expect(
      guards.some((guard) => guard.name === 'ThrottlerGuard'),
    ).toBe(true);
  });
});
