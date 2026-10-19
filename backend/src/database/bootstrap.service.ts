import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SeedService } from '../modules/admin/seed.service';

/** One-time startup work: search indexes and optional demo catalogue. */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger(BootstrapService.name);

  constructor(private readonly db: DataSource, private readonly seeds: SeedService, private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    try {
      await this.db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await this.db.query('CREATE INDEX IF NOT EXISTS products_title_trgm ON products USING gin (title gin_trgm_ops)');
      await this.db.query('CREATE INDEX IF NOT EXISTS products_brand_trgm ON products USING gin (brand gin_trgm_ops)');
    } catch (e) {
      this.log.warn(`Trigram search index not created (needs pg_trgm): ${(e as Error).message}`);
    }
    await this.seeds.ensureCategories();
    const n = this.config.get<number>('seedOnBoot') ?? 0;
    const [{ count }] = await this.db.query('SELECT count(*)::int AS count FROM products');
    if (n > 0 && count === 0) {
      this.log.log(`Empty catalogue: seeding ${n} demo products in the background`);
      void this.seeds.enqueue(n);
    }
  }
}
