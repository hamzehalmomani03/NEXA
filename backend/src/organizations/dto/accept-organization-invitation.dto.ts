import { Matches } from 'class-validator';

export class AcceptOrganizationInvitationDto {
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Invalid invitation token' })
  token!: string;
}
