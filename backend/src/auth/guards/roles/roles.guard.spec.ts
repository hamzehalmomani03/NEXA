
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrganizationRole } from '../../../generated/prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const prisma = {
    organizationMember: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          RolesGuard,
          { provide: Reflector, useValue: reflector },
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  const createContext = (body: object, user?: object) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ body, user }),
      }),
    }) as any;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const result = await guard.canActivate(
      createContext({}),
    );

    expect(result).toBe(true);
    expect(
      prisma.organizationMember.findUnique,
    ).not.toHaveBeenCalled();
  });

  it('should reject unauthenticated requests', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
    ]);

    await expect(
      guard.canActivate(
        createContext({
          organizationId: 'org-1',
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests without a valid organization ID', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
    ]);

    await expect(
      guard.canActivate(
        createContext(
          {},
          { userId: 'user-1' },
        ),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(
      prisma.organizationMember.findUnique,
    ).not.toHaveBeenCalled();
  });

  it('should reject users who are not organization members', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
    ]);

    prisma.organizationMember.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      guard.canActivate(
        createContext(
          { organizationId: 'org-1' },
          { userId: 'user-1' },
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject members without the required role', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
    ]);

    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrganizationRole.SALES,
    });

    await expect(
      guard.canActivate(
        createContext(
          { organizationId: 'org-1' },
          { userId: 'user-1' },
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow members with the required OWNER role', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ]);

    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });

    const result = await guard.canActivate(
      createContext(
        { organizationId: 'org-1' },
        { userId: 'user-1' },
      ),
    );

    expect(result).toBe(true);

    expect(
      prisma.organizationMember.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'user-1',
          organizationId: 'org-1',
        },
      },
    });
  });

  it('should allow members with the ADMIN role', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ]);

    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrganizationRole.ADMIN,
    });

    const result = await guard.canActivate(
      createContext(
        { organizationId: 'org-1' },
        { userId: 'admin-1' },
      ),
    );

    expect(result).toBe(true);
  });

  it('should reject an empty organization ID', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ]);

    await expect(
      guard.canActivate(
        createContext(
          { organizationId: '   ' },
          { userId: 'user-1' },
        ),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(
      prisma.organizationMember.findUnique,
    ).not.toHaveBeenCalled();
  });
});
