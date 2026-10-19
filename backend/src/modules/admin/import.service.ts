import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { Category } from '../catalog/category.entity';
import { ProductImage } from '../catalog/product-image.entity';
import { Product } from '../catalog/product.entity';
import { ImageMapping } from './image-mapping.entity';
import { ImportJob } from './import-job.entity';
import { JobRunner } from './job-runner.service';
import { MappingRow, ProductRow, slugify, toMappingRow, toProductRow } from './row-mappers';
import { readSheet } from './sheet-reader';

const MAX_ERRORS = 200;

/**
 * Bulk import of the products sheet and the image mapping sheet.
 * Rows are streamed from the file and written in batches with
 * INSERT .. ON CONFLICT (sku) DO UPDATE, so re-importing the same sheet updates
 * products instead of duplicating them, and memory stays flat for big files.
 */
@Injectable()
export class ImportService {
  private readonly batchSize: number;

  constructor(private readonly db: DataSource, private readonly runner: JobRunner, config: ConfigService) {
    this.batchSize = config.get<number>('importBatchSize') ?? 500;
  }

  importProducts(data: Buffer, fileName: string): Promise<ImportJob> {
    return this.runner.enqueue('PRODUCTS', fileName, async (job, progress) => {
      const categoryIds = new Map<string, string>();
      let batch: ProductRow[] = [];
      const flush = async () => {
        if (!batch.length) return;
        const n = await this.upsertProducts(batch, categoryIds);
        await progress({ upsertedRows: job.upsertedRows + n, processedRows: job.processedRows + batch.length });
        batch = [];
      };
      for await (const [rowNo, row] of readSheet(data, fileName)) {
        const parsed = toProductRow(row);
        if (parsed.ok) batch.push(parsed.value);
        else await this.recordError(job, progress, rowNo, parsed.error);
        if (batch.length >= this.batchSize) await flush();
      }
      await flush();
      await progress({ totalRows: job.processedRows + job.failedRows });
    });
  }

  importMapping(data: Buffer, fileName: string): Promise<ImportJob> {
    return this.runner.enqueue('IMAGE_MAPPING', fileName, async (job, progress) => {
      let batch: MappingRow[] = [];
      const flush = async () => {
        if (!batch.length) return;
        await this.upsertMappings(batch);
        await progress({ upsertedRows: job.upsertedRows + batch.length, processedRows: job.processedRows + batch.length });
        batch = [];
      };
      for await (const [rowNo, row] of readSheet(data, fileName)) {
        const parsed = toMappingRow(row);
        if (parsed.ok) batch.push(parsed.value);
        else await this.recordError(job, progress, rowNo, parsed.error);
        if (batch.length >= this.batchSize) await flush();
      }
      await flush();
      await progress({ totalRows: job.processedRows + job.failedRows });
    });
  }

  private async recordError(job: ImportJob, progress: (p: Partial<ImportJob>) => Promise<void>, row: number, message: string) {
    const errors = job.errors.length < MAX_ERRORS ? [...job.errors, { row, message }] : job.errors;
    await progress({ failedRows: job.failedRows + 1, errors });
  }

  async upsertMappings(rows: MappingRow[]) {
    // Positions default to the order rows appear in, per SKU.
    const seen = new Map<string, number>();
    const unique = new Map<string, ImageMapping>();
    for (const r of rows) {
      const next = seen.get(r.sku) ?? 0;
      const position = r.position ?? next;
      seen.set(r.sku, Math.max(next, position + 1));
      unique.set(r.fileName, { fileName: r.fileName, sku: r.sku, position } as ImageMapping);
    }
    await this.db
      .createQueryBuilder()
      .insert()
      .into(ImageMapping)
      .values([...unique.values()])
      .orUpdate(['sku', 'position'], ['fileName'])
      .execute();
  }

  async upsertProducts(rows: ProductRow[], categoryIds = new Map<string, string>()): Promise<number> {
    // Last row wins when a SKU repeats inside one batch (Postgres rejects double upserts).
    const bySku = new Map(rows.map((r) => [r.sku, r]));
    const unique = [...bySku.values()];

    return this.db.transaction(async (tx) => {
      for (const name of new Set(unique.map((r) => r.category).filter(Boolean) as string[])) {
        if (categoryIds.has(name)) continue;
        const slug = slugify(name);
        await tx.createQueryBuilder().insert().into(Category).values({ slug, name }).orIgnore().execute();
        const cat = await tx.getRepository(Category).findOneOrFail({ where: { slug } });
        categoryIds.set(name, cat.id);
      }

      await tx
        .createQueryBuilder()
        .insert()
        .into(Product)
        .values(
          unique.map((r) => ({
            sku: r.sku, title: r.title, description: r.description, brand: r.brand,
            categoryId: r.category ? categoryIds.get(r.category)! : null,
            price: r.price, mrp: r.mrp, stock: r.stock, condition: r.condition,
            freeShipping: r.freeShipping, specs: r.specs, isDummy: false, isActive: true,
          })),
        )
        .orUpdate(
          ['title', 'description', 'brand', 'categoryId', 'price', 'mrp', 'stock', 'condition', 'freeShipping', 'specs', 'isDummy', 'isActive', 'updatedAt'],
          ['sku'],
        )
        .execute();

      const withUrls = unique.filter((r) => r.imageUrls.length);
      const withFiles = unique.filter((r) => r.imageFiles.length);
      if (withUrls.length) {
        const ids = await tx.getRepository(Product).find({ where: { sku: In(withUrls.map((r) => r.sku)) }, select: ['id', 'sku'] });
        const idBySku = new Map(ids.map((p) => [p.sku, p.id]));
        const productIds = [...idBySku.values()];
        await tx.createQueryBuilder().delete().from(ProductImage)
          .where('"productId" IN (:...ids) AND "sourceFileName" IS NULL', { ids: productIds }).execute();
        const images = withUrls.flatMap((r) => r.imageUrls.map((url, i) => ({ productId: idBySku.get(r.sku)!, url, position: i, sourceFileName: null })));
        await tx.createQueryBuilder().insert().into(ProductImage).values(images).execute();
        await refreshThumbnails(tx, productIds);
      }
      if (withFiles.length) {
        await this.upsertMappings(withFiles.flatMap((r) => r.imageFiles.map((fileName, i) => ({ fileName, sku: r.sku, position: i }))));
      }
      return unique.length;
    });
  }
}

/** Keeps products.thumbnailUrl equal to the lowest-position image. */
export async function refreshThumbnails(tx: { query: DataSource['query'] }, productIds: string[]) {
  if (!productIds.length) return;
  await tx.query(
    `UPDATE products p SET "thumbnailUrl" =
       (SELECT url FROM product_images i WHERE i."productId" = p.id ORDER BY i.position, i.id LIMIT 1)
     WHERE p.id = ANY($1::uuid[])`,
    [productIds],
  );
}
