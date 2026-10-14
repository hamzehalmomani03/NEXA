import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(
    userId: string,
    organizationId: string,
    write = false,
  ) {
    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'You are not an active member of this organization',
      );
    }

    if (
      write &&
      !['OWNER', 'ADMIN', 'MANAGER', 'SALES'].includes(
        membership.role,
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to create sales',
      );
    }

    return membership;
  }

  private toCents(value: unknown): number {
    const amount = Number(String(value));

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid product price');
    }

    const cents = Math.round(amount * 100);

    if (!Number.isSafeInteger(cents)) {
      throw new BadRequestException('Product price is too large');
    }

    return cents;
  }

  private fromCents(value: number): string {
    return (value / 100).toFixed(2);
  }

  async create(userId: string, dto: CreateSaleDto) {
    await this.checkMembership(
      userId,
      dto.organizationId,
      true,
    );

    const quantities = new Map<string, number>();

    for (const item of dto.items) {
      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw new BadRequestException(
          'Quantity must be a positive integer',
        );
      }

      const total =
        (quantities.get(item.productId) ?? 0) +
        item.quantity;

      if (!Number.isSafeInteger(total)) {
        throw new BadRequestException(
          'Requested quantity is too large',
        );
      }

      quantities.set(item.productId, total);
    }

    const requestedItems = Array.from(
      quantities.entries(),
    ).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: requestedItems.map((item) => item.productId),
        },
        organizationId: dto.organizationId,
        status: 'ACTIVE',
      },
    });

    if (products.length !== requestedItems.length) {
      throw new BadRequestException(
        'One or more products are invalid, inactive, or belong to another organization',
      );
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotalCents = 0;

    const saleItems = requestedItems.map((requested) => {
      const product = productMap.get(requested.productId)!;

      const unitPriceCents = this.toCents(product.price);
      const unitCostCents = this.toCents(product.costPrice);
      const lineTotalCents =
        unitPriceCents * requested.quantity;

      if (!Number.isSafeInteger(lineTotalCents)) {
        throw new BadRequestException(
          'Sale item total is too large',
        );
      }

      subtotalCents += lineTotalCents;

      if (!Number.isSafeInteger(subtotalCents)) {
        throw new BadRequestException(
          'Sale total is too large',
        );
      }

      return {
        productId: product.id,
        quantity: requested.quantity,
        unitPrice: this.fromCents(unitPriceCents),
        unitCost: this.fromCents(unitCostCents),
        lineTotal: this.fromCents(lineTotalCents),
      };
    });

    const invoiceNumber =
      `INV-${Date.now()}-${randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      for (const item of requestedItems) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            organizationId: dto.organizationId,
            status: 'ACTIVE',
            stockQuantity: {
              gte: item.quantity,
            },
          },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });

        if (result.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}`,
          );
        }
      }

      const sale = await tx.sale.create({
        data: {
          organizationId: dto.organizationId,
          userId,
          invoiceNumber,
          subtotal: this.fromCents(subtotalCents),
          totalAmount: this.fromCents(subtotalCents),
          status: 'COMPLETED',
          items: {
            create: saleItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      await tx.inventoryMovement.createMany({
        data: requestedItems.map((item) => ({
          organizationId: dto.organizationId,
          productId: item.productId,
          userId,
          type: 'SALE' as const,
          quantity: item.quantity,
          note: dto.note?.trim() || 'Sale',
          reference: sale.invoiceNumber,
        })),
      });

      return sale;
    });
  }

  async findAll(userId: string, organizationId: string) {
    await this.checkMembership(userId, organizationId);

    return this.prisma.sale.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(
    userId: string,
    organizationId: string,
    saleId: string,
  ) {
    await this.checkMembership(userId, organizationId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  // Reports: real data from completed sales.
  async getReports(
    userId: string,
    organizationId: string,
    period: number,
  ) {
    await this.checkMembership(userId, organizationId);

    if (![7, 30, 90].includes(period)) {
      throw new BadRequestException(
        'Period must be 7, 30, or 90 days',
      );
    }

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - period);
    currentStart.setHours(0, 0, 0, 0);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - period);

    const [currentSales, previousSales, saleItems] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: {
            organizationId,
            status: 'COMPLETED',
            createdAt: {
              gte: currentStart,
              lte: now,
            },
          },
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
        this.prisma.sale.findMany({
          where: {
            organizationId,
            status: 'COMPLETED',
            createdAt: {
              gte: previousStart,
              lt: currentStart,
            },
          },
          select: {
            totalAmount: true,
          },
        }),
        this.prisma.saleItem.findMany({
          where: {
            sale: {
              organizationId,
              status: 'COMPLETED',
              createdAt: {
                gte: currentStart,
                lte: now,
              },
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        }),
      ]);

    const sumRevenue = (
      sales: { totalAmount: unknown }[],
    ) =>
      sales.reduce(
        (sum, sale) => sum + Number(sale.totalAmount),
        0,
      );

    const revenue = sumRevenue(currentSales);
    const previousRevenue = sumRevenue(previousSales);
    const orders = currentSales.length;
    const previousOrders = previousSales.length;

    const percentChange = (
      current: number,
      previous: number,
    ) => {
      if (previous === 0) {
        return current === 0 ? 0 : null;
      }

      return Number(
        (((current - previous) / previous) * 100).toFixed(1),
      );
    };

    const productsMap = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        sold: number;
        revenue: number;
      }
    >();

    for (const item of saleItems) {
      const product = productsMap.get(item.productId) ?? {
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        sold: 0,
        revenue: 0,
      };

      product.sold += item.quantity;
      product.revenue += Number(item.lineTotal);

      productsMap.set(item.productId, product);
    }

    const chartMap = new Map<string, number>();

    for (const sale of currentSales) {
      const date = sale.createdAt.toISOString().slice(0, 10);

      chartMap.set(
        date,
        (chartMap.get(date) ?? 0) +
          Number(sale.totalAmount),
      );
    }

    const chart = Array.from(
      chartMap,
      ([date, value]) => ({ date, value }),
    );

    const topProducts = Array.from(productsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      period,
      currency: 'JOD',
      revenue,
      orders,
      previousRevenue,
      previousOrders,
      revenueChange: percentChange(revenue, previousRevenue),
      ordersChange: percentChange(orders, previousOrders),
      averageOrder: orders > 0 ? revenue / orders : 0,
      chart,
      topProducts,
    };
  }
}