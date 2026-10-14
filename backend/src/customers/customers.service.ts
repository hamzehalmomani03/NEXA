
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(
    userId: string,
    organizationId: string,
    write = false,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        role: true,
        status: true,
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
        'You do not have permission to manage customers',
      );
    }
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateCustomerDto,
  ) {
    await this.checkMembership(userId, organizationId, true);

    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.customer.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A customer with this email already exists in this organization',
      );
    }

    return this.prisma.customer.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        email,
        phone: dto.phone.trim(),
        company: dto.company.trim(),
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async findAll(organizationId: string, userId: string) {
    await this.checkMembership(userId, organizationId);

    const customers = await this.prisma.customer.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      count: customers.length,
      customers,
    };
  }

  async findOne(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    await this.checkMembership(userId, organizationId);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateCustomerDto,
  ) {
    await this.checkMembership(userId, organizationId, true);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const data = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.email !== undefined && {
        email: dto.email.trim().toLowerCase(),
      }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.company !== undefined && {
        company: dto.company.trim(),
      }),
      ...(dto.status !== undefined && { status: dto.status }),
    };

    if (data.email) {
      const duplicate = await this.prisma.customer.findFirst({
        where: {
          organizationId,
          email: data.email,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'A customer with this email already exists in this organization',
        );
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async remove(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    await this.checkMembership(userId, organizationId, true);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Customer deleted successfully',
    };
  }
}
