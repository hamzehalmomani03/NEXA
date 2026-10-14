
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus } from '../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type Actor = {
  userId: string;
  email: string;
};

@Injectable()
export class ProductsService {
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
        'You do not have permission to manage products',
      );
    }

    return membership;
  }

  async create(dto: CreateProductDto, actor: Actor) {
    await this.assertMembership(actor.userId, dto.organizationId, true);

    try {
      const product = await this.prisma.product.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name.trim(),
          sku: dto.sku.trim(),
          description: dto.description?.trim(),
          price: dto.price,
          costPrice: dto.costPrice ?? 0,
          stockQuantity: dto.stockQuantity ?? 0,
          lowStockAt: dto.lowStockAt ?? 5,
        },
      });

      return { success: true, product };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A product with this SKU already exists in this organization',
        );
      }

      throw error;
    }
  }

  async findAll(organizationId: string, actor: Actor) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    await this.assertMembership(actor.userId, organizationId);

    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        status: ProductStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, count: products.length, products };
  }

  async findOne(id: string, actor: Actor) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.assertMembership(actor.userId, product.organizationId);

    return { success: true, product };
  }

  async update(id: string, dto: UpdateProductDto, actor: Actor) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.assertMembership(
      actor.userId,
      existing.organizationId,
      true,
    );

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.sku !== undefined && { sku: dto.sku.trim() }),
          ...(dto.description !== undefined && {
            description: dto.description.trim(),
          }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.costPrice !== undefined && {
            costPrice: dto.costPrice,
          }),
          ...(dto.stockQuantity !== undefined && {
            stockQuantity: dto.stockQuantity,
          }),
          ...(dto.lowStockAt !== undefined && {
            lowStockAt: dto.lowStockAt,
          }),
        },
      });

      return { success: true, product };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A product with this SKU already exists in this organization',
        );
      }

      throw error;
    }
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.assertMembership(
      actor.userId,
      existing.organizationId,
      true,
    );

    const product = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });

    return {
      success: true,
      message: 'Product archived successfully',
      product,
    };
  }
}
