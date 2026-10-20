
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  const confirmation = process.argv[3];

  if (!email || confirmation !== 'PROMOTE_SYSTEM_ADMIN') {
    throw new Error(
      'Provide an existing user email and PROMOTE_SYSTEM_ADMIN confirmation.',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = app.get(PrismaService);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        isSystemAdmin: true,
      },
    });

    if (!user) {
      throw new Error('User not found. Check the email address.');
    }

    if (!user.isActive) {
      throw new Error('The account is inactive.');
    }

    if (user.isSystemAdmin) {
      console.log('This account is already a Super Admin.');
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isSystemAdmin: true },
    });

    console.log('Super Admin promotion successful.');
    console.log(`Account: ${user.email}`);
    console.log('isSystemAdmin: true');
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  console.error(
    'Super Admin promotion failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
