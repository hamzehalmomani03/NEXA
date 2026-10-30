import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { OrganizationRole } from '../../generated/prisma/client';

export class CreateOrganizationInvitationDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
