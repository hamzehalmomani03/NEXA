
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { CreateUserDto } from '../auth/dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin/system-admin.guard';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
  };
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Accessible to any authenticated user; reads identity from verified JWT.
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findMe(request.user.userId);
  }

  @Patch('me')
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    updateMyProfileDto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMe(request.user.userId, updateMyProfileDto);
  }

  // Admin-only routes retain their original restriction.
  @Get()
  @UseGuards(SystemAdminGuard)
  getUsers() {
    return this.usersService.findAll();
  }

  @Post()
  @UseGuards(SystemAdminGuard)
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}

