
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authenticatedUser = request.user as
      | { userId: string }
      | undefined;

    if (!authenticatedUser?.userId) {
      throw new UnauthorizedException(
        'Authentication is required',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: authenticatedUser.userId,
      },
      select: {
        isActive: true,
        isSystemAdmin: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'User is not active or does not exist',
      );
    }

    if (!user.isSystemAdmin) {
      throw new ForbiddenException(
        'System administrator access is required',
      );
    }

    return true;
  }
}