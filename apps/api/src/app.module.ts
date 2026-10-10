import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';

/** Every client may make this many requests per minute (the web client polls the render about 80 times a minute). */
const REQUESTS_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300);

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: REQUESTS_PER_MINUTE }])],
  controllers: [JobsController],
  providers: [JobsService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
