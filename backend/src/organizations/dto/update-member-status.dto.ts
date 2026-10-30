import { IsIn } from 'class-validator';

import { MembershipStatus } from '../../generated/prisma/client';

export class UpdateMemberStatusDto {
  @IsIn([
    MembershipStatus.ACTIVE,
    MembershipStatus.INACTIVE,
  ])
  status: MembershipStatus;
}
