import {
  Body,
  Controller,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

import { OrganizationMembersService } from './organization-members.service';

import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

import { UpdateMemberStatusDto } from './dto/update-member-status.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('organizations/:organizationId/members')
@UseGuards(JwtAuthGuard)
export class OrganizationMembersController {
  constructor(
    private readonly membersService: OrganizationMembersService,
  ) {}

  @Patch(':memberId/role')
  updateRole(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(
      organizationId,
      memberId,
      request.user.userId,
      body.role,
    );
  }

  @Patch(':memberId/status')
  updateStatus(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateMemberStatusDto,
  ) {
    return this.membersService.updateStatus(
      organizationId,
      memberId,
      request.user.userId,
      body.status,
    );
  }
}
