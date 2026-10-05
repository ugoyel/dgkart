/** Writes openapi.json so the website / other clients can generate typed SDKs. */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { AppModule } from '../app.module';
import { buildOpenApi } from '../openapi';

(async () => {
  process.env.SEED_ON_BOOT = '0';
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'uploads/(.*)'] });
  await app.init();
  writeFileSync('openapi.json', JSON.stringify(buildOpenApi(app), null, 2));
  await app.close();
  console.log('wrote openapi.json');
})();
