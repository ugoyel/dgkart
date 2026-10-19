/** CLI: `npm run seed -- 5000` seeds demo products without starting the HTTP server. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from '../modules/admin/seed.service';

(async () => {
  process.env.SEED_ON_BOOT = '0';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const count = parseInt(process.argv[2] ?? '1000', 10);
  await app.get(SeedService).seed(count, async (n) => void process.stdout.write(`\rseeded ${n}/${count}`));
  process.stdout.write('\n');
  await app.close();
})();
