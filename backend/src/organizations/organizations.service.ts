
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrganizationRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    name: string,
    slug: string,
    userId: string,
  ) {
    const existingOrganization =
      await this.prisma.organization.findUnique({
        where: { slug },
      });

    if (existingOrganization) {
      throw new ConflictException(
        'Organization slug is already registered',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Active user not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
        },
      });

      return {
        success: true,
        organization,
        membership: {
          userId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
        },
      };
    });
  }

  async addMember(
    userId: string,
    organizationId: string,
    role: OrganizationRole,
  ) {
    const [user, organization, existingMembership] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
        }),
        this.prisma.organization.findUnique({
          where: { id: organizationId },
        }),
        this.prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },
        }),
      ]);

    if (!user || !user.isActive) {
      throw new NotFoundException('Active user not found');
    }

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (
      role === OrganizationRole.OWNER ||
      role === OrganizationRole.ADMIN
    ) {
      throw new ConflictException(
        'Assigning OWNER or ADMIN roles is not allowed through this endpoint',
      );
    }

    if (existingMembership) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    return this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId,
        role,
      },
    });
  }

  async findMyOrganizations(userId: string) {
    const memberships =
      await this.prisma.organizationMember.findMany({
        where: {
          userId,
        },
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return {
      success: true,
      organizations: memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
        joinedAt: membership.createdAt,
      })),
    };
  }

  async findOne(
    organizationId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              members: {
                select: {
                  id: true,
                  role: true,
                  status: true,
                  createdAt: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    return {
      success: true,
      organization: {
        ...membership.organization,
        role: membership.role,
        joinedAt: membership.createdAt,
        members: membership.organization.members.map(
          (member) => ({
            id: member.id,
            role: member.role,
            status: member.status,
            joinedAt: member.createdAt,
            user: member.user,
          }),
        ),
      },
    };
  }
}
