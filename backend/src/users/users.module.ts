
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { SystemAdminGuard } from '../auth/guards/system-admin/system-admin.guard';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, SystemAdminGuard],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}