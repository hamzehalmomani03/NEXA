
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(
      loginDto.email,
      loginDto.password,
    );
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login/2fa')
  verifyTwoFactorLogin(
    @Body() body: { challengeToken: string; code: string },
  ) {
    if (
      typeof body?.challengeToken !== 'string' ||
      typeof body?.code !== 'string' ||
      body.challengeToken.length > 4096 ||
      body.code.length > 100
    ) {
      throw new BadRequestException('Challenge token and code are required');
    }

    return this.authService.verifyTwoFactorLogin(
      body.challengeToken,
      body.code,
    );
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return {
      success: true,
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  getTwoFactorStatus(@Req() request: AuthenticatedRequest) {
    return this.authService.getTwoFactorStatus(request.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  startTwoFactorSetup(@Req() request: AuthenticatedRequest) {
    return this.authService.startTwoFactorSetup(request.user.userId);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/confirm')
  confirmTwoFactorSetup(
    @Req() request: AuthenticatedRequest,
    @Body() body: { code: string },
  ) {
    if (typeof body?.code !== 'string') {
      throw new BadRequestException('Verification code is required');
    }

    return this.authService.confirmTwoFactorSetup(
      request.user.userId,
      body.code,
    );
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/disable')
  disableTwoFactor(
    @Req() request: AuthenticatedRequest,
    @Body() body: { password: string; code: string },
  ) {
    if (
      typeof body?.password !== 'string' ||
      typeof body?.code !== 'string'
    ) {
      throw new BadRequestException('Password and code are required');
    }

    return this.authService.disableTwoFactor(
      request.user.userId,
      body.password,
      body.code,
    );
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/recovery-codes')
  regenerateRecoveryCodes(
    @Req() request: AuthenticatedRequest,
    @Body() body: { code: string },
  ) {
    if (typeof body?.code !== 'string') {
      throw new BadRequestException('Verification code is required');
    }

    return this.authService.regenerateRecoveryCodes(
      request.user.userId,
      body.code,
    );
  }
}
