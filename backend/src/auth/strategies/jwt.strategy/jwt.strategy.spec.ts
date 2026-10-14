
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const configServiceMock = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          JwtStrategy,
          {
            provide: ConfigService,
            useValue: configServiceMock,
          },
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns user data when the user is active', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member@nexa.local',
      firstName: 'Test',
      lastName: 'Member',
      isActive: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'member@nexa.local',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'member@nexa.local',
      firstName: 'Test',
      lastName: 'Member',
    });
  });

  it('rejects inactive users', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member@nexa.local',
      firstName: 'Test',
      lastName: 'Member',
      isActive: false,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'member@nexa.local',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects users who do not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'missing-user',
        email: 'member@nexa.local',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token with a mismatched email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member@nexa.local',
      firstName: 'Test',
      lastName: 'Member',
      isActive: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'wrong@nexa.local',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});