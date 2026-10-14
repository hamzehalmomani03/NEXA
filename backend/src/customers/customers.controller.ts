
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
  ) {}

  @Post()
  create(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateCustomerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.create(
      organizationId,
      request.user.userId,
      dto,
    );
  }

  @Get()
  findAll(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.findAll(
      organizationId,
      request.user.userId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.findOne(
      id,
      organizationId,
      request.user.userId,
    );
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: UpdateCustomerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.update(
      id,
      organizationId,
      request.user.userId,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.remove(
      id,
      organizationId,
      request.user.userId,
    );
  }
}
