
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin/system-admin.guard';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminController', () => {
  let controller: PlatformAdminController;

  const platformAdminServiceMock = {
    getDashboardStats: jest.fn(),
    listOrganizations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAdminController],
      providers: [
        {
          provide: PlatformAdminService,
          useValue: platformAdminServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PlatformAdminController>(
      PlatformAdminController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return platform dashboard statistics', async () => {
    const expected = {
      success: true,
      data: {
        organizations: 5,
        users: 12,
        activeUsers: 10,
        products: 30,
        completedSalesCount: 20,
        completedSalesTotal: 1500,
      },
    };

    platformAdminServiceMock.getDashboardStats.mockResolvedValue(expected);

    await expect(controller.getDashboardStats()).resolves.toEqual(expected);

    expect(
      platformAdminServiceMock.getDashboardStats,
    ).toHaveBeenCalledTimes(1);
  });

  it('should use default pagination values', async () => {
    const expected = {
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };

    platformAdminServiceMock.listOrganizations.mockResolvedValue(expected);

    const result = await controller.listOrganizations();

    expect(result).toEqual(expected);
    expect(
      platformAdminServiceMock.listOrganizations,
    ).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('should parse pagination and trim search', async () => {
    platformAdminServiceMock.listOrganizations.mockResolvedValue({
      success: true,
      data: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    await controller.listOrganizations('2', '10', '  demo  ');

    expect(
      platformAdminServiceMock.listOrganizations,
    ).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: 'demo',
    });
  });

  it('should reject invalid page values', () => {
    expect(() => controller.listOrganizations('0')).toThrow(
      BadRequestException,
    );

    expect(() => controller.listOrganizations('abc')).toThrow(
      BadRequestException,
    );
  });

  it('should reject invalid limit values', () => {
    expect(() => controller.listOrganizations('1', '-5')).toThrow(
      BadRequestException,
    );

    expect(() => controller.listOrganizations('1', '1.5')).toThrow(
      BadRequestException,
    );
  });
});
