
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OrganizationListQuery {
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      organizationCount,
      userCount,
      activeUserCount,
      productCount,
      completedSales,
    ] = await this.prisma.$transaction([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { isActive: true },
      }),
      this.prisma.product.count(),
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      
    ]);
    

    return {
      success: true,
      data: {
        organizations: organizationCount,
        users: userCount,
        activeUsers: activeUserCount,
        products: productCount,
        completedSalesCount: completedSales._count.id,
        completedSalesTotal: completedSales._sum.totalAmount ?? 0,
      },
    };
  }

  async listOrganizations(query: OrganizationListQuery) {
    const page = Math.max(1, Math.floor(query.page));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit)));
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [organizations, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      success: true,
      data: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        memberCount: organization._count.members,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listUsers(query: OrganizationListQuery) {
    const page = Math.max(1, Math.floor(query.page));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit)));
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isSystemAdmin: true,
          createdAt: true,
          _count: {
            select: { memberships: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: users.map((user) => ({
        ...user,
        organizationsCount: user._count.memberships,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async setUserActiveStatus(userId: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isSystemAdmin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isSystemAdmin) {
      throw new ForbiddenException(
        'System administrator accounts cannot be changed through this endpoint',
      );
    }

    if (user.isActive === isActive) {
      return {
        success: true,
        message: `User is already ${isActive ? 'active' : 'inactive'}`,
        data: user,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        isActive: true,
        isSystemAdmin: true,
      },
    });

    return {
      success: true,
      message: isActive
        ? 'User activated successfully'
        : 'User deactivated successfully',
      data: updatedUser,
    };
  }

  async listProducts(query: OrganizationListQuery) {
    const page = Math.max(1, Math.floor(query.page));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit)));
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            {
              organization: {
                name: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
          ],
        }
      : {};

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stockQuantity: true,
          status: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
    async setOrganizationActiveStatus(
    organizationId: string,
    isActive: boolean,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.isActive === isActive) {
      return {
        success: true,
        message: `Organization is already ${
          isActive ? 'active' : 'inactive'
        }`,
        data: organization,
      };
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    });

    return {
      success: true,
      message: isActive
        ? 'Organization activated successfully'
        : 'Organization deactivated successfully',
      data: updatedOrganization,
    };
  }
}
