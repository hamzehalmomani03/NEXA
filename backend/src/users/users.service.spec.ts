
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Hamzeh',
    lastName: 'Almomani',
    isActive: true,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          UsersService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns users without password hashes, newest first', async () => {
      prismaMock.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual([mockUser]);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('returns an empty array when no users exist', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    const createUserDto = {
      email: 'new@example.com',
      password: 'StrongPassword123!',
      firstName: 'New',
      lastName: 'User',
    };

    it('creates a user with a hashed password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      (bcrypt.hash as jest.Mock).mockResolvedValue(
        'hashed-password',
      );

      prismaMock.user.create.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      });

      const result = await service.create(createUserDto);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: createUserDto.email,
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(
        createUserDto.password,
        12,
      );

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          passwordHash: 'hashed-password',
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email addresses', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create(createUserDto),
      ).rejects.toThrow(ConflictException);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });
});