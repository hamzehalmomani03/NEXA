

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UpdateUserStatusDto } from './update-user-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin/system-admin.guard';
import {
  OrganizationListQuery,
  PlatformAdminService,
} from './platform-admin.service';

@Controller('platform-admin')
@UseGuards(JwtAuthGuard, SystemAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platformAdminService: PlatformAdminService,
  ) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.platformAdminService.getDashboardStats();
  }

  @Get('organizations')
  listOrganizations(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
    @Query('search') search?: string,
  ) {
    const page = this.parsePositiveInteger(pageParam, 1, 'page');
    const limit = this.parsePositiveInteger(limitParam, 20, 'limit');

    const query: OrganizationListQuery = {
      page,
      limit,
      ...(search?.trim() ? { search: search.trim() } : {}),
    };

    return this.platformAdminService.listOrganizations(query);
  }

  @Get('users')
listUsers(
  @Query('page') pageParam?: string,
  @Query('limit') limitParam?: string,
  @Query('search') search?: string,
) {
  const page = this.parsePositiveInteger(pageParam, 1, 'page');
  const limit = this.parsePositiveInteger(limitParam, 20, 'limit');

  const query: OrganizationListQuery = {
    page,
    limit,
    ...(search?.trim() ? { search: search.trim() } : {}),
  };

  return this.platformAdminService.listUsers(query);
}

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    if (typeof body?.isActive !== 'boolean') {
      throw new BadRequestException(
        'isActive must be a boolean',
      );
    }

    return this.platformAdminService.setUserActiveStatus(
      id,
      body.isActive,
    );
  }
    @Patch('organizations/:id/status')
  updateOrganizationStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    if (typeof body?.isActive !== 'boolean') {
      throw new BadRequestException(
        'isActive must be a boolean',
      );
    }

    return this.platformAdminService.setOrganizationActiveStatus(
      id,
      body.isActive,
    );
  }


@Get('products')
listProducts(
  @Query('page') pageParam?: string,
  @Query('limit') limitParam?: string,
  @Query('search') search?: string,
) {
  const page = this.parsePositiveInteger(pageParam, 1, 'page');
  const limit = this.parsePositiveInteger(limitParam, 20, 'limit');

  const query: OrganizationListQuery = {
    page,
    limit,
    ...(search?.trim() ? { search: search.trim() } : {}),
  };

  return this.platformAdminService.listProducts(query);
}
  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    field: string,
  ): number {
    if (value === undefined || value.trim() === '') {
      return defaultValue;
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(
        `${field} must be a positive integer`,
      );
    }

    return parsed;
  }
}
