
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrganizationsService } from './organizations.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { OrganizationRole } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles/roles.decorator';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMyOrganizations(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.findMyOrganizations(
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.findOne(
      organizationId,
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.create(
      createOrganizationDto.name,
      createOrganizationDto.slug,
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Post('members')
  addMember(@Body() body: AddMemberDto) {
    return this.organizationsService.addMember(
      body.userId,
      body.organizationId,
      body.role,
    );
  }
}
