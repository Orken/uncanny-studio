import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Behind a reverse proxy, set TRUST_PROXY (e.g. 1) so the rate limit sees the real client IP.
  if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
  // Same-origin by default (the web app is served by the API, or proxied in development): CORS stays off unless origins are listed.
  const origins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean);
  if (origins?.length) app.enableCors({ origin: origins });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const webDist = process.env.WEB_DIST;
  if (webDist) app.useStaticAssets(join(webDist));
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();
