import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationInvitationsService } from './organization-invitations.service';

describe('OrganizationInvitationsService', () => {
  const actorId = 'owner-id';
  const organizationId = 'org-id';
  const recipientEmail = 'employee@example.com';

  let service: OrganizationInvitationsService;
  let prisma: any;
  let mail: any;

  beforeEach(() => {
    prisma = {
      organizationMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      organizationInvitation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    mail = { sendOrganizationInvitationEmail: jest.fn().mockResolvedValue(undefined) };
    service = new OrganizationInvitationsService(
      prisma as PrismaService,
      mail as MailService,
    );
    prisma.organizationMember.findUnique.mockResolvedValue({
      status: MembershipStatus.ACTIVE,
      role: OrganizationRole.OWNER,
      user: { isActive: true },
      organization: { id: organizationId, name: 'Test Organization', isActive: true },
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.organizationInvitation.findFirst.mockResolvedValue(null);
    prisma.organizationInvitation.create.mockImplementation(async ({ data }: any) => ({
      id: 'inv-1', email: data.email, role: data.role,
      status: InvitationStatus.PENDING, expiresAt: data.expiresAt,
      createdAt: new Date(),
    }));
    prisma.organizationInvitation.updateMany.mockResolvedValue({ count: 1 });
  });

  it('sends an invitation with a token whose hash is stored, not the token', async () => {
    const result = await service.invite(
      organizationId, actorId, ' Employee@Example.com ', OrganizationRole.SALES,
    );
    const [, , link] = mail.sendOrganizationInvitationEmail.mock.calls[0];
    const token = new URL(link).searchParams.get('token')!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.organizationInvitation.create.mock.calls[0][0].data.tokenHash)
      .toBe(createHash('sha256').update(token).digest('hex'));
    expect(result.invitation.email).toBe(recipientEmail);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('does not allow inviting an OWNER', async () => {
    await expect(
      service.invite(organizationId, actorId, recipientEmail, OrganizationRole.OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.sendOrganizationInvitationEmail).not.toHaveBeenCalled();
  });

  it('rejects an inactive inviter even if they are an owner', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      status: MembershipStatus.INACTIVE,
      role: OrganizationRole.OWNER,
      user: { isActive: true },
      organization: { id: organizationId, name: 'Test', isActive: true },
    });
    await expect(
      service.invite(organizationId, actorId, recipientEmail, OrganizationRole.SALES),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes a newly created invitation if email delivery fails', async () => {
    mail.sendOrganizationInvitationEmail.mockRejectedValue(new Error('SMTP down'));
    await expect(
      service.invite(organizationId, actorId, recipientEmail, OrganizationRole.SALES),
    ).rejects.toThrow('SMTP down');
    expect(prisma.organizationInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvitationStatus.REVOKED }),
      }),
    );
  });

  it('refuses acceptance by a different email address', async () => {
    const token = 'a'.repeat(64);
    prisma.user.findUnique.mockResolvedValue({ email: 'wrong@example.com', isActive: true });
    prisma.organizationInvitation.findUnique.mockResolvedValue({
      id: 'inv-1', organizationId, email: recipientEmail,
      role: OrganizationRole.SALES, status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      organization: { id: organizationId, name: 'Test Organization', isActive: true },
    });
    await expect(service.accept('employee-id', token))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('consumes the invitation and creates an ACTIVE membership in one transaction', async () => {
    const token = 'b'.repeat(64);
    prisma.user.findUnique.mockResolvedValue({ email: recipientEmail, isActive: true });
    prisma.organizationInvitation.findUnique.mockResolvedValue({
      id: 'inv-1', organizationId, email: recipientEmail,
      role: OrganizationRole.SALES, status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      organization: { id: organizationId, name: 'Test Organization', isActive: true },
    });
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    const result = await service.accept('employee-id', token);
    expect(prisma.organizationInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      }),
    );
    expect(prisma.organizationMember.create).toHaveBeenCalledWith({
      data: {
        userId: 'employee-id', organizationId,
        role: OrganizationRole.SALES,
        status: MembershipStatus.ACTIVE,
      },
    });
    expect(result.success).toBe(true);
  });

  it('prevents a replayed invitation from creating a membership', async () => {
    const token = 'c'.repeat(64);
    prisma.user.findUnique.mockResolvedValue({ email: recipientEmail, isActive: true });
    prisma.organizationInvitation.findUnique.mockResolvedValue({
      id: 'inv-1', organizationId, email: recipientEmail,
      role: OrganizationRole.SALES, status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      organization: { id: organizationId, name: 'Test Organization', isActive: true },
    });
    prisma.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    await expect(service.accept('employee-id', token))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });
});
