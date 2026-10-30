import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  MembershipStatus,
  OrganizationRole,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationMembersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async authorizeManager(
    organizationId: string,
    actorId: string,
  ) {
    const actor =
      await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: actorId,
            organizationId,
          },
        },
        select: {
          role: true,
          status: true,
          user: {
            select: {
              isActive: true,
            },
          },
          organization: {
            select: {
              isActive: true,
            },
          },
        },
      });

    if (
      !actor ||
      !actor.user.isActive ||
      !actor.organization.isActive ||
      actor.status !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Active organization membership required',
      );
    }

    if (
      actor.role !== OrganizationRole.OWNER &&
      actor.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You cannot manage organization members',
      );
    }

    return actor;
  }

  private async findEditableMember(
    organizationId: string,
    memberId: string,
    actorId: string,
    actorRole: OrganizationRole,
  ) {
    const member =
      await this.prisma.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          user: {
            select: {
              isActive: true,
            },
          },
        },
      });

    if (!member) {
      throw new NotFoundException(
        'Organization member not found',
      );
    }

    if (member.userId === actorId) {
      throw new ForbiddenException(
        'You cannot modify your own membership',
      );
    }

    if (member.role === OrganizationRole.OWNER) {
      throw new ForbiddenException(
        'The organization owner is protected',
      );
    }

    if (
      actorRole === OrganizationRole.ADMIN &&
      member.role === OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only the owner can manage administrators',
      );
    }

    if (member.status === MembershipStatus.INVITED) {
      throw new ConflictException(
        'Pending memberships must be handled through invitations',
      );
    }

    return member;
  }

  private async getMember(memberId: string) {
    return this.prisma.organizationMember.findUnique({
      where: {
        id: memberId,
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
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
    });
  }

  async updateRole(
    organizationId: string,
    memberId: string,
    actorId: string,
    role: OrganizationRole,
  ) {
    const actor = await this.authorizeManager(
      organizationId,
      actorId,
    );

    if (role === OrganizationRole.OWNER) {
      throw new ForbiddenException(
        'OWNER role cannot be assigned through this endpoint',
      );
    }

    if (
      role !== OrganizationRole.ADMIN &&
      role !== OrganizationRole.MANAGER &&
      role !== OrganizationRole.ACCOUNTANT &&
      role !== OrganizationRole.SALES
    ) {
      throw new BadRequestException(
        'Invalid organization role',
      );
    }

    if (
      role === OrganizationRole.ADMIN &&
      actor.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only the owner can assign ADMIN role',
      );
    }

    const member = await this.findEditableMember(
      organizationId,
      memberId,
      actorId,
      actor.role,
    );

    const updated =
      await this.prisma.organizationMember.updateMany({
        where: {
          id: member.id,
          organizationId,
          role: member.role,
          status: member.status,
        },
        data: {
          role,
        },
      });

    if (updated.count !== 1) {
      throw new ConflictException(
        'Membership changed. Please refresh and retry.',
      );
    }

    return {
      success: true,
      message: 'Member role updated',
      member: await this.getMember(memberId),
    };
  }

  async updateStatus(
    organizationId: string,
    memberId: string,
    actorId: string,
    status: MembershipStatus,
  ) {
    const actor = await this.authorizeManager(
      organizationId,
      actorId,
    );

    if (
      status !== MembershipStatus.ACTIVE &&
      status !== MembershipStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'Only ACTIVE and INACTIVE statuses are allowed',
      );
    }

    const member = await this.findEditableMember(
      organizationId,
      memberId,
      actorId,
      actor.role,
    );

    if (
      status === MembershipStatus.ACTIVE &&
      !member.user.isActive
    ) {
      throw new ConflictException(
        'The user account is inactive',
      );
    }

    const updated =
      await this.prisma.organizationMember.updateMany({
        where: {
          id: member.id,
          organizationId,
          role: member.role,
          status: member.status,
        },
        data: {
          status,
        },
      });

    if (updated.count !== 1) {
      throw new ConflictException(
        'Membership changed. Please refresh and retry.',
      );
    }

    return {
      success: true,
      message:
        status === MembershipStatus.ACTIVE
          ? 'Member activated'
          : 'Member deactivated',
      member: await this.getMember(memberId),
    };
  }
}
