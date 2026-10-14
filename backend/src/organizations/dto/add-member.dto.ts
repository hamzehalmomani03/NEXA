
import {
  IsEnum,
  IsUUID,
} from 'class-validator';

import { OrganizationRole } from '../../generated/prisma/client';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  organizationId: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}