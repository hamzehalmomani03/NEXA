
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { RestockDto } from './dto/restock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @Post('restock')
  restock(
    @Body() dto: RestockDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.restock(dto, request.user);
  }

  @Post('adjust')
  adjust(
    @Body() dto: AdjustStockDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.adjust(dto, request.user);
  }

  @Get('movements')
  getMovements(
    @Query('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.getMovements(
      organizationId,
      request.user,
    );
  }

  @Get('low-stock')
  getLowStock(
    @Query('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.getLowStock(
      organizationId,
      request.user,
    );
  }
}
