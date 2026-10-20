
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
      host: this.configService.get<string>(
        'SMTP_HOST',
        'smtp.gmail.com',
      ),
      port: Number(this.configService.get('SMTP_PORT') ?? 587),
      secure: false,
      auth: {
        user,
        pass,
      },
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
    } catch {
      console.error('NEXA email delivery failed.');

      throw new InternalServerErrorException(
        'Unable to send email at this time',
      );
    }
  }
}
