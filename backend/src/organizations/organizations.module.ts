import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

import { OrganizationInvitationsController } from './organization-invitations.controller';
import { OrganizationInvitationsService } from './organization-invitations.service';

import { OrganizationMembersController } from './organization-members.controller';
import { OrganizationMembersService } from './organization-members.service';

import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    OrganizationsController,
    OrganizationInvitationsController,
    OrganizationMembersController,
  ],
  providers: [
    OrganizationsService,
    OrganizationInvitationsService,
    OrganizationMembersService,
    RolesGuard,
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
