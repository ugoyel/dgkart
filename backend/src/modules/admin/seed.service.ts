import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Category } from '../catalog/category.entity';
import { ProductImage } from '../catalog/product-image.entity';
import { Product, ProductCondition } from '../catalog/product.entity';
import { ImportJob } from './import-job.entity';
import { JobRunner } from './job-runner.service';
import { CONDITION_WEIGHTS, EDITIONS, SEED_CATALOG, VARIANTS, demoImage } from './seed-data';

const BATCH = 500;

/** Small deterministic PRNG so the same index always yields the same demo product. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

@Injectable()
export class SeedService {
  private readonly log = new Logger(SeedService.name);

  constructor(private readonly db: DataSource, private readonly runner: JobRunner) {}

  async ensureCategories(): Promise<Map<string, string>> {
    const repo = this.db.getRepository(Category);
    const ids = new Map<string, string>();
    let order = 0;
    for (const parent of SEED_CATALOG) {
      await repo.createQueryBuilder().insert().values({ slug: parent.slug, name: parent.name, sortOrder: order++ }).orIgnore().execute();
      const p = await repo.findOneOrFail({ where: { slug: parent.slug } });
      ids.set(parent.slug, p.id);
      for (const child of parent.children) {
        await repo.createQueryBuilder().insert().values({ slug: child.slug, name: child.name, parentId: p.id, sortOrder: order++ }).orIgnore().execute();
        const c = await repo.findOneOrFail({ where: { slug: child.slug } });
        ids.set(child.slug, c.id);
      }
    }
    // Category tiles on the home screen use a demo image too.
    await this.db.query(
      `UPDATE categories SET "imageUrl" = 'https://picsum.photos/seed/cat-' || slug || '/400/400' WHERE "imageUrl" IS NULL`,
    );
    return ids;
  }

  enqueue(count: number): Promise<ImportJob> {
    return this.runner.enqueue('SEED', `${count} demo products`, async (job, progress) => {
      await progress({ totalRows: count });
      await this.seed(count, async (done) => progress({ processedRows: done, upsertedRows: done }));
    });
  }

  async seed(count: number, onProgress?: (done: number) => Promise<void>): Promise<number> {
    const catIds = await this.ensureCategories();
    const leaves = SEED_CATALOG.flatMap((p) => p.children);
    const start = (await this.db.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 6) AS INTEGER)), 0) AS n FROM products WHERE sku ~ '^DEMO-[0-9]+$'`))[0].n as number;

    let done = 0;
    while (done < count) {
      const size = Math.min(BATCH, count - done);
      const products: Partial<Product>[] = [];
      const imageCounts: number[] = [];
      for (let i = 0; i < size; i++) {
        const idx = start + done + i + 1;
        const r = rng(idx * 7919);
        const leaf = leaves[idx % leaves.length];
        const item = leaf.items[Math.floor(r() * leaf.items.length)];
        const brand = leaf.brands[Math.floor(r() * leaf.brands.length)];
        const variant = VARIANTS[Math.floor(r() * VARIANTS.length)];
        const edition = EDITIONS[Math.floor(r() * EDITIONS.length)];
        const [lo, hi] = leaf.price;
        const price = Math.round((lo + Math.pow(r(), 2) * (hi - lo)) / 10) * 10 - 1;
        const hasDiscount = r() < 0.7;
        const mrp = hasDiscount ? Math.round((price * (1.1 + r() * 0.6)) / 10) * 10 - 1 : null;
        let roll = r();
        const condition = (CONDITION_WEIGHTS.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'NEW') as ProductCondition;
        const sku = `DEMO-${idx}`;
        products.push({
          sku,
          title: [brand, item, edition, `(${variant})`].filter(Boolean).join(' '),
          description:
            `${brand} ${item} in ${variant}. Demo listing for the DKKart catalogue.\n\n` +
            `• Genuine ${brand} product with seller warranty\n• Ships in 1-3 business days\n• Easy 7-day returns\n\n` +
            `This is sample data and can be removed from the admin screen.`,
          brand,
          categoryId: catIds.get(leaf.slug)!,
          price,
          mrp,
          stock: Math.floor(r() * 200),
          condition,
          freeShipping: price >= 499 || r() < 0.4,
          specs: { Brand: brand, Colour: variant, Model: `${brand.slice(0, 3).toUpperCase()}-${1000 + (idx % 9000)}`, Type: item, Warranty: `${1 + Math.floor(r() * 2)} Year` },
          rating: Math.round((3.2 + r() * 1.8) * 10) / 10,
          reviewCount: Math.floor(Math.pow(r(), 3) * 5000),
          soldCount: Math.floor(Math.pow(r(), 2) * 3000),
          thumbnailUrl: demoImage(sku, 0),
          isDummy: true,
          isActive: true,
        });
        imageCounts.push(2 + Math.floor(r() * 3));
      }

      await this.db.transaction(async (tx) => {
        const inserted = await tx.createQueryBuilder().insert().into(Product).values(products).orIgnore().returning(['id', 'sku']).execute();
        const idBySku = new Map<string, string>((inserted.raw as { id: string; sku: string }[]).map((r) => [r.sku, r.id]));
        const images: Partial<ProductImage>[] = [];
        products.forEach((p, i) => {
          const id = idBySku.get(p.sku!);
          if (!id) return;
          for (let n = 0; n < imageCounts[i]; n++) images.push({ productId: id, url: demoImage(p.sku!, n), position: n, sourceFileName: null });
        });
        if (images.length) await tx.createQueryBuilder().insert().into(ProductImage).values(images).execute();
      });
      done += size;
      await onProgress?.(done);
    }
    this.log.log(`Seeded ${count} demo products`);
    return count;
  }

  /** Deletes every seeded product (images, cart and watchlist rows cascade). Real imported products are untouched. */
  async wipeDummy(): Promise<{ deleted: number }> {
    const res = await this.db.query(`WITH d AS (DELETE FROM products WHERE "isDummy" = true RETURNING 1) SELECT count(*)::int AS n FROM d`);
    return { deleted: res[0].n };
  }

  /** Removes the whole catalogue ("blank out"). Orders keep their own snapshot of item details. */
  async wipeAll(): Promise<{ deleted: number }> {
    const res = await this.db.query(`WITH d AS (DELETE FROM products RETURNING 1) SELECT count(*)::int AS n FROM d`);
    await this.db.query('DELETE FROM image_mappings');
    return { deleted: res[0].n };
  }
}
