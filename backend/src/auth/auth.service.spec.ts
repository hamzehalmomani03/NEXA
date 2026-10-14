
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwtServiceMock = {
    sign: jest.fn(),
    signAsync: jest.fn(),
    verify: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Hamzeh',
    lastName: 'Almomani',
    passwordHash: 'hashed-password',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
          {
            provide: JwtService,
            useValue: jwtServiceMock,
          },
        ],
      }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns safe user data for valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'correct-password',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        'hashed-password',
      );

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Hamzeh',
        lastName: 'Almomani',
        isActive: true,
      });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects an unknown email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('unknown@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects an inactive user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects an incorrect password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prismaMock.user.update.mockResolvedValue({});

      await expect(
        service.validateUser('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });
    });

    it('locks the account after 5 failed attempts', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4,
        lockedUntil: null,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prismaMock.user.update.mockResolvedValue({});

      await expect(
        service.validateUser('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        },
      });

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      const remainingLockMs =
        updateCall.data.lockedUntil.getTime() - Date.now();

      expect(remainingLockMs).toBeGreaterThan(14 * 60 * 1000);
      expect(remainingLockMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('rejects login while the account is locked', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      await expect(
        service.validateUser('test@example.com', 'correct-password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('resets expired lockout attempts when the password is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000),
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prismaMock.user.update.mockResolvedValue({});

      await expect(
        service.validateUser('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });
    });

    it('resets failed attempts after successful login', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 3,
        lockedUntil: null,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prismaMock.user.update.mockResolvedValue({});

      await service.validateUser(
        'test@example.com',
        'correct-password',
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });
  });

  describe('login', () => {
    it('returns an access token and safe user data', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtServiceMock.signAsync.mockResolvedValue('test-access-token');

      const result = await service.login(
        'test@example.com',
        'correct-password',
      );

      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
      });

      expect(result).toEqual({
        success: true,
        accessToken: 'test-access-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'Hamzeh',
          lastName: 'Almomani',
          isActive: true,
        },
      });
    });

    it('does not issue a token for invalid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });
  });
});