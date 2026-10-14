
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import * as QRCode from 'qrcode';

import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

type ChallengePayload = {
  sub: string;
  email: string;
  purpose: string;
};

@Injectable()
export class AuthService {
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDurationMs = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getEncryptionKey(): Buffer {
    const value = process.env.TWO_FACTOR_ENCRYPTION_KEY;

    if (!value) {
      throw new InternalServerErrorException(
        'Two-factor encryption is not configured',
      );
    }

    const key = Buffer.from(value, 'base64');

    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'Two-factor encryption key must be 32 bytes encoded as Base64',
      );
    }

    return key;
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      iv,
    );

    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  private decryptSecret(value: string): string {
    try {
      const [ivText, tagText, encryptedText] = value.split('.');

      if (!ivText || !tagText || !encryptedText) {
        throw new Error('Invalid encrypted value');
      }

      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(ivText, 'base64'),
      );

      decipher.setAuthTag(Buffer.from(tagText, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Unable to decrypt the two-factor secret',
      );
    }
  }

  private encodeBase32(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private decodeBase32(input: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = input.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of normalized) {
      const index = alphabet.indexOf(char);

      if (index < 0) {
        throw new BadRequestException('Invalid authenticator secret');
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  private verifyTotp(secret: string, input: string): boolean {
    if (!/^\d{6}$/.test(input)) {
      return false;
    }

    const key = this.decodeBase32(secret);
    const currentStep = Math.floor(Date.now() / 1000 / 30);

    for (let offset = -1; offset <= 1; offset++) {
      const counter = BigInt(currentStep + offset);
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeBigUInt64BE(counter);

      const digest = createHmac('sha1', key)
        .update(counterBuffer)
        .digest();

      const index = digest[digest.length - 1] & 0x0f;

      const binary =
        ((digest[index] & 0x7f) << 24) |
        ((digest[index + 1] & 0xff) << 16) |
        ((digest[index + 2] & 0xff) << 8) |
        (digest[index + 3] & 0xff);

      const expected = String(binary % 1_000_000).padStart(6, '0');
      const actualBuffer = Buffer.from(expected);
      const inputBuffer = Buffer.from(input);

      if (
        actualBuffer.length === inputBuffer.length &&
        timingSafeEqual(actualBuffer, inputBuffer)
      ) {
        return true;
      }
    }

    return false;
  }

  private hashRecoveryCode(code: string): string {
    return createHash('sha256')
      .update(code.trim().toUpperCase().replace(/-/g, ''))
      .digest('hex');
  }

  private createRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
  }

  private safeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
    };
  }

  private async issueAccessToken(user: SafeUser) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      purpose: 'access',
    });

    return {
      success: true,
      accessToken,
      user,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const currentAttempts =
      user.lockedUntil && user.lockedUntil <= now
        ? 0
        : (user.failedLoginAttempts ?? 0);

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const failedAttempts = currentAttempts + 1;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil:
            failedAttempts >= this.maxLoginAttempts
              ? new Date(now.getTime() + this.lockoutDurationMs)
              : null,
        },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    if (currentAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const safeUser = this.safeUser(user);

    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          purpose: '2fa-login',
        },
        { expiresIn: '5m' },
      );

      return {
        success: true,
        requiresTwoFactor: true,
        challengeToken,
      };
    }

    return this.issueAccessToken(safeUser);
  }

  async verifyTwoFactorLogin(
    challengeToken: string,
    code: string,
  ) {
    let payload: ChallengePayload;

    try {
      payload = await this.jwtService.verifyAsync<ChallengePayload>(
        challengeToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired login challenge');
    }

    if (
      payload.purpose !== '2fa-login' ||
      !payload.sub ||
      !payload.email
    ) {
      throw new UnauthorizedException('Invalid login challenge');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      !user.isActive ||
      !user.twoFactorEnabled ||
      user.email !== payload.email ||
      !user.twoFactorSecretEncrypted
    ) {
      throw new UnauthorizedException('Two-factor verification failed');
    }

    const normalizedCode = code.trim();
    const secret = this.decryptSecret(user.twoFactorSecretEncrypted);

    let verified = this.verifyTotp(secret, normalizedCode);

    if (!verified) {
      const recoveryHash = this.hashRecoveryCode(normalizedCode);

      const remainingCodes = user.twoFactorRecoveryCodeHashes.filter(
        (hash) => hash !== recoveryHash,
      );

      if (remainingCodes.length !== user.twoFactorRecoveryCodeHashes.length) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodeHashes: remainingCodes },
        });

        verified = true;
      }
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return this.issueAccessToken(this.safeUser(user));
  }

  async startTwoFactorSetup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = this.encodeBase32(randomBytes(20));

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorPendingSecretEncrypted: this.encryptSecret(secret),
      },
    });

    const issuer = 'NEXA';
    const label = encodeURIComponent(`${issuer}:${user.email}`);
    const otpauthUrl =
      `otpauth://totp/${label}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
      '&algorithm=SHA1&digits=6&period=30';

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      success: true,
      qrCodeDataUrl,
      manualEntryKey: secret,
    };
  }

  async confirmTwoFactorSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      !user ||
      !user.twoFactorPendingSecretEncrypted ||
      user.twoFactorEnabled
    ) {
      throw new BadRequestException('Start two-factor setup first');
    }

    const secret = this.decryptSecret(
      user.twoFactorPendingSecretEncrypted,
    );

    if (!this.verifyTotp(secret, code.trim())) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = this.createRecoveryCodes();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: user.twoFactorPendingSecretEncrypted,
        twoFactorPendingSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: recoveryCodes.map((item) =>
          this.hashRecoveryCode(item),
        ),
      },
    });

    return {
      success: true,
      message: 'Two-factor authentication enabled',
      recoveryCodes,
    };
  }

  async disableTwoFactor(
    userId: string,
    password: string,
    code: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      !user ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecretEncrypted
    ) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid password or verification code');
    }

    const secret = this.decryptSecret(user.twoFactorSecretEncrypted);

    if (!this.verifyTotp(secret, code.trim())) {
      throw new UnauthorizedException('Invalid password or verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorPendingSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: [],
      },
    });

    return {
      success: true,
      message: 'Two-factor authentication disabled',
    };
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      !user ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecretEncrypted
    ) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const secret = this.decryptSecret(user.twoFactorSecretEncrypted);

    if (!this.verifyTotp(secret, code.trim())) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = this.createRecoveryCodes();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorRecoveryCodeHashes: recoveryCodes.map((item) =>
          this.hashRecoveryCode(item),
        ),
      },
    });

    return {
      success: true,
      recoveryCodes,
    };
  }

  async getTwoFactorStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodeHashes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      success: true,
      enabled: user.twoFactorEnabled,
      remainingRecoveryCodes: user.twoFactorRecoveryCodeHashes.length,
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const organizationName = dto.organizationName.trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const baseSlug =
      organizationName
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'business';

    const slug = `${baseSlug}-${randomBytes(4).toString('hex')}`;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        });

        const organization = await tx.organization.create({
          data: {
            name: organizationName,
            slug,
          },
        });

        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: OrganizationRole.OWNER,
          },
        });

        return { user, organization };
      });

      const accessToken = await this.jwtService.signAsync({
        sub: result.user.id,
        email: result.user.email,
        purpose: 'access',
      });

      return {
        success: true,
        accessToken,
        user: result.user,
        organization: result.organization,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email or organization identifier is already registered. Please try again.',
        );
      }

      throw error;
    }
  }
}
