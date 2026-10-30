import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { AcceptOrganizationInvitationDto } from './dto/accept-organization-invitation.dto';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { OrganizationInvitationsService } from './organization-invitations.service';

type AuthenticatedRequest = Request & {
  user: { userId: string; email: string };
};

@Controller('organizations')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class OrganizationInvitationsController {
  constructor(
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  @Post(':id/invitations')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  invite(
    @Param('id') organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateOrganizationInvitationDto,
  ) {
    return this.invitationsService.invite(
      organizationId,
      request.user.userId,
      body.email,
      body.role,
    );
  }

  @Get(':id/invitations')
  list(
    @Param('id') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.invitationsService.list(organizationId, request.user.userId);
  }

  @Delete(':id/invitations/:invitationId')
  revoke(
    @Param('id') organizationId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.invitationsService.revoke(
      organizationId,
      invitationId,
      request.user.userId,
    );
  }

  @Post('invitations/accept')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(
    @Req() request: AuthenticatedRequest,
    @Body() body: AcceptOrganizationInvitationDto,
  ) {
    return this.invitationsService.accept(request.user.userId, body.token);
  }
}
