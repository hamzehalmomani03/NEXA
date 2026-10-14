
import { Test, TestingModule } from '@nestjs/testing';

import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  const organizationsServiceMock = {
    findMyOrganizations: jest.fn(),
    create: jest.fn(),
    addMember: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [OrganizationsController],
        providers: [
          {
            provide: OrganizationsService,
            useValue: organizationsServiceMock,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

    controller = module.get<OrganizationsController>(
      OrganizationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the current user organizations', async () => {
    const request = {
      user: {
        userId: 'user-1',
        email: 'test@example.com',
      },
    } as any;

    const result = {
      success: true,
      organizations: [],
    };

    organizationsServiceMock.findMyOrganizations.mockResolvedValue(
      result,
    );

    await expect(
      controller.findMyOrganizations(request),
    ).resolves.toEqual(result);

    expect(
      organizationsServiceMock.findMyOrganizations,
    ).toHaveBeenCalledWith('user-1');
  });

  it('should create an organization for the authenticated user', async () => {
    const dto = {
      name: 'Test Organization',
      slug: 'test-organization',
    };

    const request = {
      user: {
        userId: 'user-1',
        email: 'test@example.com',
      },
    } as any;

    const result = {
      success: true,
      organization: {
        id: 'org-1',
        ...dto,
      },
      membership: {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'OWNER',
      },
    };

    organizationsServiceMock.create.mockResolvedValue(result);

    await expect(
      controller.createOrganization(dto, request),
    ).resolves.toEqual(result);

    expect(organizationsServiceMock.create).toHaveBeenCalledWith(
      dto.name,
      dto.slug,
      'user-1',
    );
  });

  it('should add a member using the provided DTO', async () => {
    const dto = {
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'SALES',
    };

    const result = {
      id: 'membership-1',
      ...dto,
    };

    organizationsServiceMock.addMember.mockResolvedValue(result);

    await expect(
      controller.addMember(dto as any),
    ).resolves.toEqual(result);

    expect(organizationsServiceMock.addMember).toHaveBeenCalledWith(
      dto.userId,
      dto.organizationId,
      dto.role,
    );
  });
});