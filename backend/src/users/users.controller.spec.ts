
import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin/system-admin.guard';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          {
            provide: UsersService,
            useValue: usersServiceMock,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(SystemAdminGuard)
        .useValue({ canActivate: () => true })
        .compile();

    controller =
      module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return all users from the service', async () => {
    const users = [
      {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
    ];

    usersServiceMock.findAll.mockResolvedValue(users);

    await expect(controller.getUsers()).resolves.toEqual(users);

    expect(usersServiceMock.findAll).toHaveBeenCalledTimes(1);
  });

  it('should create a user through the service', async () => {
    const dto = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'StrongPass123',
    };

    const createdUser = {
      id: 'user-1',
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
    };

    usersServiceMock.create.mockResolvedValue(createdUser);

    await expect(controller.createUser(dto)).resolves.toEqual(
      createdUser,
    );

    expect(usersServiceMock.create).toHaveBeenCalledWith(dto);
  });
});