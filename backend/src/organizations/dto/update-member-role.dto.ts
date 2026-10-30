import { IsEnum } from 'class-validator';

import { OrganizationRole } from '../../generated/prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}
