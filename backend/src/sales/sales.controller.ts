import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
  ) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(
      req.user.userId,
      dto,
    );
  }

  @Get('reports')
  getReports(
    @Req() req: AuthenticatedRequest,
    @Query('organizationId', ParseUUIDPipe)
    organizationId: string,
    @Query('period') period = '7',
  ) {
    const days = Number(period);

    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException(
        'Period must be 7, 30, or 90 days',
      );
    }

    return this.salesService.getReports(
      req.user.userId,
      organizationId,
      days,
    );
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('organizationId', ParseUUIDPipe)
    organizationId: string,
  ) {
    return this.salesService.findAll(
      req.user.userId,
      organizationId,
    );
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Query('organizationId', ParseUUIDPipe)
    organizationId: string,
    @Param('id', ParseUUIDPipe)
    saleId: string,
  ) {
    return this.salesService.findOne(
      req.user.userId,
      organizationId,
      saleId,
    );
  }
}