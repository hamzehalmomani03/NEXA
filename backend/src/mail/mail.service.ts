
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[char];
  });
}

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      throw new Error('SMTP_USER and SMTP_PASS must be configured');
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.configService.get('SMTP_PORT') ?? 587),
      secure: false,
      auth: { user, pass },
    });
  }

  async sendPasswordResetEmail(
    recipient: string,
    resetUrl: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: {
          name: 'NEXA',
          address: this.configService.get<string>('SMTP_USER')!,
        },
        to: recipient,
        subject: 'Reset Your NEXA Password',
        text: [
          'We received a request to reset your NEXA password.',
          '',
          `Open this link to choose a new password: ${resetUrl}`,
          '',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
            <h2>Reset your NEXA password</h2>
            <p>We received a request to reset your password.</p>
            <p>
              <a href="${resetUrl}"
                 style="display:inline-block;padding:12px 20px;background:#34d399;color:#052e24;text-decoration:none;border-radius:8px;">
                Reset Password
              </a>
            </p>
            <p>If the button does not work, open this link:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error: unknown) {
      const mailError = error instanceof Error
        ? error as Error & {
            code?: string;
            responseCode?: number;
            command?: string;
          }
        : undefined;

      console.error('NEXA password reset email delivery failed.', {
        message: mailError?.message ?? 'Unknown email delivery error',
        code: mailError?.code,
        responseCode: mailError?.responseCode,
        command: mailError?.command,
      });

      throw new InternalServerErrorException(
        'Unable to send email at this time',
      );
    }
  }

  async sendOrganizationInvitationEmail(
    recipient: string,
    organizationName: string,
    invitationUrl: string,
    role: string,
  ): Promise<void> {
    const safeOrganization = escapeHtml(organizationName);
    const safeRole = escapeHtml(role);
    const safeUrl = escapeHtml(invitationUrl);

    try {
      await this.transporter.sendMail({
        from: {
          name: 'NEXA',
          address: this.configService.get<string>('SMTP_USER')!,
        },
        to: recipient,
        subject: `Invitation to join ${organizationName} on NEXA`,
        text: [
          `You have been invited to join ${organizationName} on NEXA.`,
          `Role: ${role}`,
          '',
          `Accept your invitation: ${invitationUrl}`,
          '',
          'This invitation expires in 7 days. If you did not expect this invitation, ignore this message.',
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102a22">
            <div style="background:#071a15;padding:22px;border-radius:14px 14px 0 0">
              <h1 style="color:#34d399;margin:0;letter-spacing:3px">NEXA</h1>
            </div>
            <div style="padding:24px;border:1px solid #d9e9df;border-radius:0 0 14px 14px">
              <h2>You're invited!</h2>
              <p>You've been invited to join <strong>${safeOrganization}</strong> on NEXA.</p>
              <p>Role: <strong>${safeRole}</strong></p>
              <p style="margin:28px 0">
                <a href="${safeUrl}"
                   style="background:#34d399;color:#06251b;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Accept invitation
                </a>
              </p>
              <p>If the button doesn't work, open this link:</p>
              <p><a href="${safeUrl}">${safeUrl}</a></p>
              <p style="color:#536c61;font-size:13px">Expires in 7 days. If you did not expect this email, ignore it.</p>
            </div>
          </div>
        `,
      });
    } catch (error: unknown) {
      const mailError = error instanceof Error
        ? error as Error & {
            code?: string;
            responseCode?: number;
            command?: string;
          }
        : undefined;

      console.error(
        'NEXA organization invitation email delivery failed.',
        {
          message: mailError?.message ?? 'Unknown email delivery error',
          code: mailError?.code,
          responseCode: mailError?.responseCode,
          command: mailError?.command,
        },
      );

      throw new InternalServerErrorException(
        'Unable to send invitation email at this time',
      );
    }
  }
}
