
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const txMock = {
    organization: {
      create: jest.fn(),
    },
    organizationMember: {
      create: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback) => callback(txMock),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          OrganizationsService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service =
      module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    const organizationId = 'org-123';
    const userId = 'user-123';

    const joinedAt = new Date(
      '2026-10-01T10:00:00.000Z',
    );

    const organizationCreatedAt = new Date(
      '2026-09-01T10:00:00.000Z',
    );

    it('should return the organization for an authorized member', async () => {
      const membership = {
        role: OrganizationRole.OWNER,
        createdAt: joinedAt,
        organization: {
          id: organizationId,
          name: 'Test Organization',
          slug: 'test-organization',
          createdAt: organizationCreatedAt,
          members: [
            {
              id: 'membership-123',
              role: OrganizationRole.OWNER,
              createdAt: joinedAt,
              user: {
                id: userId,
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
              },
            },
          ],
        },
      };

      prismaMock.organizationMember.findUnique.mockResolvedValue(
        membership,
      );

      const result = await service.findOne(
        organizationId,
        userId,
      );

      expect(result).toEqual({
        success: true,
        organization: {
          id: organizationId,
          name: 'Test Organization',
          slug: 'test-organization',
          createdAt: organizationCreatedAt,
          role: OrganizationRole.OWNER,
          joinedAt,
          members: [
            {
              id: 'membership-123',
              role: OrganizationRole.OWNER,
              joinedAt,
              user: {
                id: userId,
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
              },
            },
          ],
        },
      });

      expect(
        prismaMock.organizationMember.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              members: {
                select: {
                  id: true,
                  role: true,
                  createdAt: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },
        },
      });
    });

    it('should reject a user who is not a member of the organization', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(organizationId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaMock.organizationMember.findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },
        }),
      );
    });
  });

  describe('create', () => {
    const name = 'Test Organization';
    const slug = 'test-organization';
    const userId = 'user-123';

    it('should create an organization and assign its creator as OWNER', async () => {
      const user = {
        id: userId,
        isActive: true,
      };

      const organization = {
        id: 'org-123',
        name,
        slug,
      };

      prismaMock.organization.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(user);

      txMock.organization.create.mockResolvedValue(organization);

      txMock.organizationMember.create.mockResolvedValue({
        userId,
        organizationId: organization.id,
        role: OrganizationRole.OWNER,
      });

      const result = await service.create(
        name,
        slug,
        userId,
      );

      expect(result).toEqual({
        success: true,
        organization,
        membership: {
          userId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
        },
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.organization.create).toHaveBeenCalledWith({
        data: {
          name,
          slug,
        },
      });

      expect(
        txMock.organizationMember.create,
      ).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
        },
      });
    });

    it('should reject an already registered slug', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'existing-org',
        name,
        slug,
      });

      await expect(
        service.create(name, slug, userId),
      ).rejects.toThrow(ConflictException);

      expect(
        prismaMock.user.findUnique,
      ).not.toHaveBeenCalled();

      expect(
        prismaMock.$transaction,
      ).not.toHaveBeenCalled();
    });

    it('should reject a missing or inactive user', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        isActive: false,
      });

      await expect(
        service.create(name, slug, userId),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaMock.$transaction,
      ).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    const userId = 'user-456';
    const organizationId = 'org-123';
    const role = OrganizationRole.SALES;

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        isActive: true,
      });

      prismaMock.organization.findUnique.mockResolvedValue({
        id: organizationId,
        name: 'Test Organization',
      });

      prismaMock.organizationMember.findUnique.mockResolvedValue(
        null,
      );

      prismaMock.organizationMember.create.mockResolvedValue({
        userId,
        organizationId,
        role,
      });
    });

    it('should add a member with an allowed role', async () => {
      const result = await service.addMember(
        userId,
        organizationId,
        role,
      );

      expect(result).toEqual({
        userId,
        organizationId,
        role,
      });

      expect(
        prismaMock.organizationMember.create,
      ).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId,
          role,
        },
      });
    });

    it('should reject a missing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(userId, organizationId, role),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaMock.organizationMember.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject an inactive user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        isActive: false,
      });

      await expect(
        service.addMember(userId, organizationId, role),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaMock.organizationMember.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject a missing organization', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(userId, organizationId, role),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaMock.organizationMember.create,
      ).not.toHaveBeenCalled();
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ])(
      'should reject assigning the role %s',
      async (restrictedRole) => {
        await expect(
          service.addMember(
            userId,
            organizationId,
            restrictedRole,
          ),
        ).rejects.toThrow(ConflictException);

        expect(
          prismaMock.organizationMember.create,
        ).not.toHaveBeenCalled();
      },
    );

    it('should reject an existing membership', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue({
        userId,
        organizationId,
        role,
      });

      await expect(
        service.addMember(userId, organizationId, role),
      ).rejects.toThrow(ConflictException);

      expect(
        prismaMock.organizationMember.create,
      ).not.toHaveBeenCalled();
    });
  });
});
