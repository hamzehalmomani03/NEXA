
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminService', () => {
  let service: PlatformAdminService;

  const prismaMock = {
    $transaction: jest.fn(),
    organization: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    sale: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAdminService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PlatformAdminService>(PlatformAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics from database queries', async () => {
      prismaMock.$transaction.mockResolvedValue([
        5,
        12,
        10,
        30,
        {
          _count: { id: 20 },
          _sum: { totalAmount: 1500 },
        },
      ]);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        success: true,
        data: {
          organizations: 5,
          users: 12,
          activeUsers: 10,
          products: 30,
          completedSalesCount: 20,
          completedSalesTotal: 1500,
        },
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should return zero sales total when there are no completed sales', async () => {
      prismaMock.$transaction.mockResolvedValue([
        0,
        0,
        0,
        0,
        {
          _count: { id: 0 },
          _sum: { totalAmount: null },
        },
      ]);

      const result = await service.getDashboardStats();

      expect(result.data.completedSalesCount).toBe(0);
      expect(result.data.completedSalesTotal).toBe(0);
    });
  });

  describe('listOrganizations', () => {
    it('should return paginated organizations without exposing tenant data', async () => {
      const organizations = [
        {
          id: 'org-1',
          name: 'Test Organization',
          slug: 'test-organization',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          _count: {
            members: 3,
          },
        },
      ];

      prismaMock.$transaction.mockResolvedValue([organizations, 1]);

      const result = await service.listOrganizations({
        page: 1,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      expect(result.data[0]).toEqual({
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-organization',
        createdAt: organizations[0].createdAt,
        updatedAt: organizations[0].updatedAt,
        memberCount: 3,
      });

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });

      expect(result.data[0]).not.toHaveProperty('sales');
      expect(result.data[0]).not.toHaveProperty('customers');
    });

    it('should normalize pagination values and cap the limit at 100', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      const result = await service.listOrganizations({
        page: -2.8,
        limit: 500,
      });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(100);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should trim the search term', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      await service.listOrganizations({
        page: 1,
        limit: 20,
        search: '  demo  ',
      });

      const expectedWhere = {
        OR: [
          {
            name: {
              contains: 'demo',
              mode: 'insensitive',
            },
          },
          {
            slug: {
              contains: 'demo',
              mode: 'insensitive',
            },
          },
        ],
      };

      expect(prismaMock.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );

      expect(prismaMock.organization.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });
  });
});
