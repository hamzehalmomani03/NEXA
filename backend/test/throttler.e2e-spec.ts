
import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import request from 'supertest';

@Controller('rate-limit-test')
class RateLimitTestController {
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get()
  checkRateLimit() {
    return { success: true };
  }
}

describe('Throttler (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60_000,
            limit: 5,
          },
        ]),
      ],
      controllers: [RateLimitTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject the sixth request within one minute', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < 5; i++) {
      await request(server)
        .get('/rate-limit-test')
        .expect(200);
    }

    await request(server)
      .get('/rate-limit-test')
      .expect(429);
  });
});
