
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { createHash, randomBytes } from 'crypto';

import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from '../generated/prisma/client';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITABLE_ROLES: OrganizationRole[] = [
  OrganizationRole.MANAGER,
  OrganizationRole.ACCOUNTANT,
  OrganizationRole.SALES,
];

@Injectable()
export class OrganizationInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async authorizeManager(
    organizationId: string,
    actorId: string,
  ) {
    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: actorId,
            organizationId,
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          user: {
            select: {
              isActive: true,
            },
          },
        },
      });

    if (!membership || !membership.organization.isActive) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    if (
      !membership.user.isActive ||
      membership.status !== MembershipStatus.ACTIVE ||
      (
        membership.role !== OrganizationRole.OWNER &&
        membership.role !== OrganizationRole.ADMIN
      )
    ) {
      throw new ForbiddenException(
        'You cannot manage invitations for this organization',
      );
    }

    return membership.organization;
  }

  async invite(
    organizationId: string,
    actorId: string,
    emailInput: string,
    role: OrganizationRole,
  ) {
    const organization = await this.authorizeManager(
      organizationId,
      actorId,
    );

    const email =
      typeof emailInput === 'string'
        ? emailInput.trim().toLowerCase()
        : '';

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      throw new BadRequestException(
        'A valid email is required',
      );
    }

    if (!INVITABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        'Only MANAGER, ACCOUNTANT and SALES roles can be invited',
      );
    }

    const existingUser =
      await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
        },
      });

    if (existingUser) {
      const membership =
        await this.prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId,
            },
          },
          select: {
            id: true,
          },
        });

      if (membership) {
        throw new ConflictException(
          'This email is already associated with this organization',
        );
      }
    }

    const rawToken = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    let invitation: {
      id: string;
      email: string;
      role: OrganizationRole;
      status: InvitationStatus;
      expiresAt: Date;
      createdAt: Date;
    };

    try {
      invitation = await this.prisma.$transaction(
        async (tx) => {
          const pending =
            await tx.organizationInvitation.findFirst({
              where: {
                organizationId,
                email,
                status: InvitationStatus.PENDING,
                expiresAt: {
                  gt: new Date(),
                },
              },
              select: {
                id: true,
              },
            });

          if (pending) {
            throw new ConflictException(
              'An active invitation already exists for this email',
            );
          }

          return tx.organizationInvitation.create({
            data: {
              organizationId,
              invitedById: actorId,
              email,
              role,
              tokenHash,
              expiresAt,
            },
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              expiresAt: true,
              createdAt: true,
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Concurrent invitation request; please retry',
        );
      }

      throw error;
    }

    const frontendUrl =
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    let inviteUrl: URL;

    try {
      inviteUrl = new URL(
        '/accept-invitation',
        frontendUrl,
      );

      if (
        !['http:', 'https:'].includes(inviteUrl.protocol)
      ) {
        throw new Error(
          'Unsupported frontend URL protocol',
        );
      }
    } catch {
      await this.prisma.organizationInvitation.updateMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      throw new BadRequestException(
        'FRONTEND_URL is invalid',
      );
    }

    inviteUrl.searchParams.set('token', rawToken);

    try {
      await this.mail.sendOrganizationInvitationEmail(
        email,
        organization.name,
        inviteUrl.toString(),
        role,
      );
    } catch (error) {
      await this.prisma.organizationInvitation.updateMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      throw error;
    }

    return {
      success: true,
      invitation,
    };
  }

  async list(
    organizationId: string,
    actorId: string,
  ) {
    await this.authorizeManager(
      organizationId,
      actorId,
    );

    const invitations =
      await this.prisma.organizationInvitation.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return {
      success: true,
      invitations,
    };
  }

  async revoke(
    organizationId: string,
    invitationId: string,
    actorId: string,
  ) {
    await this.authorizeManager(
      organizationId,
      actorId,
    );

    const result =
      await this.prisma.organizationInvitation.updateMany({
        where: {
          id: invitationId,
          organizationId,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

    if (result.count !== 1) {
      throw new NotFoundException(
        'Pending invitation not found',
      );
    }

    return {
      success: true,
      message: 'Invitation revoked',
    };
  }

  async accept(
    userId: string,
    rawToken: string,
  ) {
    if (
      typeof rawToken !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(rawToken)
    ) {
      throw new BadRequestException(
        'Invalid or expired invitation',
      );
    }

    const tokenHash = createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const [user, invitation] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          email: true,
          isActive: true,
        },
      }),

      this.prisma.organizationInvitation.findUnique({
        where: {
          tokenHash,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Active account required',
      );
    }

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= new Date() ||
      !invitation.organization.isActive
    ) {
      throw new BadRequestException(
        'Invalid or expired invitation',
      );
    }

    if (
      user.email.trim().toLowerCase() !==
      invitation.email
    ) {
      throw new ForbiddenException(
        'This invitation is for a different email address',
      );
    }

    if (!INVITABLE_ROLES.includes(invitation.role)) {
      throw new ForbiddenException(
        'Invitation role is not allowed',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed =
        await tx.organizationInvitation.updateMany({
          where: {
            id: invitation.id,
            status: InvitationStatus.PENDING,
            expiresAt: {
              gt: new Date(),
            },
          },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
        });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Invitation has already been used or expired',
        );
      }

      const membership =
        await tx.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId: invitation.organizationId,
            },
          },
          select: {
            id: true,
          },
        });

      if (membership) {
        throw new ConflictException(
          'You are already a member of this organization',
        );
      }

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    return {
      success: true,
      message: 'Invitation accepted',
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        role: invitation.role,
      },
    };
  }
}
