
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { SystemAdminGuard } from './system-admin.guard';
import { PrismaService } from '../../../prisma/prisma.service';

describe('SystemAdminGuard', () => {
  let guard: SystemAdminGuard;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemAdminGuard,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    guard = module.get<SystemAdminGuard>(SystemAdminGuard);
  });

  const createContext = (user?: object) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    await expect(
      guard.canActivate(createContext()),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should reject users who do not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ userId: 'user-1' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: false,
      isSystemAdmin: true,
    });

    await expect(
      guard.canActivate(createContext({ userId: 'user-1' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject users who are not system administrators', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      isSystemAdmin: false,
    });

    await expect(
      guard.canActivate(createContext({ userId: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow active system administrators', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      isSystemAdmin: true,
    });

    const result = await guard.canActivate(
      createContext({ userId: 'admin-1' }),
    );

    expect(result).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      select: {
        isActive: true,
        isSystemAdmin: true,
      },
    });
  });
});