
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  ProductStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestockDto } from './dto/restock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

type Actor = {
  userId: string;
  email: string;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(
    userId: string,
    organizationId: string,
    canWrite = false,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: { user: true },
    });

    if (!membership || !membership.user.isActive) {
      throw new NotFoundException('Organization not found');
    }

    if (
      canWrite &&
      !['OWNER', 'ADMIN', 'MANAGER'].includes(membership.role)
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify inventory',
      );
    }

    return membership;
  }

  async restock(dto: RestockDto, actor: Actor) {
    await this.assertMembership(actor.userId, dto.organizationId, true);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          organizationId: dto.organizationId,
          status: ProductStatus.ACTIVE,
        },
      });

      if (!product) {
        throw new NotFoundException('Active product not found');
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: { increment: dto.quantity },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: dto.organizationId,
          productId: product.id,
          userId: actor.userId,
          type: InventoryMovementType.RESTOCK,
          quantity: dto.quantity,
          note: dto.note?.trim(),
        },
      });

      return {
        success: true,
        message: 'Stock replenished successfully',
        product: updatedProduct,
        movement,
      };
    });
  }

  async adjust(dto: AdjustStockDto, actor: Actor) {
    await this.assertMembership(actor.userId, dto.organizationId, true);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          organizationId: dto.organizationId,
          status: ProductStatus.ACTIVE,
        },
      });

      if (!product) {
        throw new NotFoundException('Active product not found');
      }

      const isIncoming = dto.type === 'ADJUSTMENT_IN';

      if (!isIncoming && product.stockQuantity < dto.quantity) {
        throw new BadRequestException(
          'Insufficient stock for this adjustment',
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: isIncoming
            ? { increment: dto.quantity }
            : { decrement: dto.quantity },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: dto.organizationId,
          productId: product.id,
          userId: actor.userId,
          type: dto.type,
          quantity: dto.quantity,
         note: dto.note?.trim(),
        },
      });

      return {
        success: true,
        message: 'Inventory adjusted successfully',
        product: updatedProduct,
        movement,
      };
    });
  }

  async getMovements(organizationId: string, actor: Actor) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    await this.assertMembership(actor.userId, organizationId);

    const movements = await this.prisma.inventoryMovement.findMany({
      where: { organizationId },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      success: true,
      count: movements.length,
      movements,
    };
  }

  async getLowStock(organizationId: string, actor: Actor) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    await this.assertMembership(actor.userId, organizationId);

    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        status: ProductStatus.ACTIVE,
      },
      orderBy: { stockQuantity: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockAt: true,
      },
    });

    const lowStockProducts = products.filter(
      (product) => product.stockQuantity <= product.lowStockAt,
    );

    return {
      success: true,
      count: lowStockProducts.length,
      products: lowStockProducts,
    };
  }
}
