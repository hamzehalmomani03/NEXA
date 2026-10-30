import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MembershipStatus, OrganizationRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES_KEY } from '../../decorators/roles/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string; email: string } | undefined;

    if (!user?.userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    const paramId = request.params?.organizationId ?? request.params?.id;
    const bodyId = request.body?.organizationId;

    if (paramId && bodyId && paramId !== bodyId) {
      throw new ForbiddenException('Organization ID mismatch');
    }

    const organizationId: unknown = paramId ?? bodyId;

    if (typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new ForbiddenException('A valid organization ID is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.userId,
          organizationId,
        },
      },
      include: { organization: { select: { isActive: true } } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (
      membership.status !== MembershipStatus.ACTIVE ||
      !membership.organization.isActive
    ) {
      throw new ForbiddenException('Your organization membership is not active');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
