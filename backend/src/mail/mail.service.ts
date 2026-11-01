
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

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

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

@Injectable()
export class MailService {
  constructor(private readonly configService: ConfigService) {}

  private async sendEmail(
    recipient: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'GMAIL_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>(
      'GMAIL_REDIRECT_URI',
    );
    const refreshToken = this.configService.get<string>(
      'GMAIL_REFRESH_TOKEN',
    );
    const senderEmail = this.configService.get<string>(
      'GMAIL_SENDER_EMAIL',
    );

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri ||
      !refreshToken ||
      !senderEmail
    ) {
      throw new Error('Gmail API environment variables are missing');
    }

    const auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    auth.setCredentials({
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth,
    });

    const encodedSubject = Buffer.from(subject, 'utf8').toString(
      'base64',
    );

    const boundary = 'NEXA_EMAIL_BOUNDARY';

    const rawMessage = [
      `From: NEXA <${senderEmail}>`,
      `To: ${recipient}`,
      `Subject: =?UTF-8?B?${encodedSubject}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(text, 'utf8').toString('base64'),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodeBase64Url(rawMessage),
      },
    });
  }

  async sendPasswordResetEmail(
    recipient: string,
    resetUrl: string,
  ): Promise<void> {
    try {
      const safeUrl = escapeHtml(resetUrl);

      await this.sendEmail(
        recipient,
        'Reset Your NEXA Password',
        [
          'We received a request to reset your NEXA password.',
          '',
          `Open this link to choose a new password: ${resetUrl}`,
          '',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
            <h2>Reset your NEXA password</h2>
            <p>We received a request to reset your password.</p>
            <p>
              <a href="${safeUrl}"
                 style="display:inline-block;padding:12px 20px;background:#34d399;color:#052e24;text-decoration:none;border-radius:8px;">
                Reset Password
              </a>
            </p>
            <p>If the button does not work, open this link:</p>
            <p><a href="${safeUrl}">${safeUrl}</a></p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      );
    } catch (error: unknown) {
      console.error('NEXA password reset email delivery failed.', {
        message: error instanceof Error ? error.message : 'Unknown error',
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
      await this.sendEmail(
        recipient,
        `Invitation to join ${organizationName} on NEXA`,
        [
          `You have been invited to join ${organizationName} on NEXA.`,
          `Role: ${role}`,
          '',
          `Accept your invitation: ${invitationUrl}`,
          '',
          'This invitation expires in 7 days. If you did not expect this invitation, ignore this message.',
        ].join('\n'),
        `
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
              <p style="color:#536c61;font-size:13px">Expires in 7 days. If you did not expect this invitation, ignore it.</p>
            </div>
          </div>
        `,
      );
    } catch (error: unknown) {
      console.error(
        'NEXA organization invitation email delivery failed.',
        {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      throw new InternalServerErrorException(
        'Unable to send invitation email at this time',
      );
    }
  }
}
