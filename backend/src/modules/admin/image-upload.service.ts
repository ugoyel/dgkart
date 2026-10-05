import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { DataSource, In } from 'typeorm';
import { ProductImage } from '../catalog/product-image.entity';
import { Product } from '../catalog/product.entity';
import { StorageService } from '../storage/storage.service';
import { ImageMapping } from './image-mapping.entity';
import { refreshThumbnails } from './import.service';
import { guessFromFileName, normalizeFileName } from './row-mappers';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface UploadResult {
  matched: { file: string; sku: string; position: number }[];
  unmatched: { file: string; reason: string }[];
}

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * Attaches uploaded image files to products. Each file name is looked up in the
 * admin's mapping sheet (image_mappings); if absent, the name itself is tried as
 * "<SKU>.jpg" or "<SKU>_<position>.jpg". Re-uploading a file with the same name
 * replaces the earlier image instead of adding a duplicate.
 */
@Injectable()
export class ImageUploadService {
  constructor(private readonly db: DataSource, private readonly storage: StorageService) {}

  async attach(files: UploadedFile[]): Promise<UploadResult> {
    const result: UploadResult = { matched: [], unmatched: [] };
    const names = files.map((f) => normalizeFileName(f.originalname));
    const mappings = await this.db.getRepository(ImageMapping).find({ where: { fileName: In(names) } });
    const mapByFile = new Map(mappings.map((m) => [m.fileName, m]));

    const candidates = files.map((f, i) => {
      const m = mapByFile.get(names[i]);
      return m ? [{ sku: m.sku, position: m.position }] : guessFromFileName(names[i]);
    });
    const skus = [...new Set(candidates.flat().map((c) => c.sku))];
    const products = skus.length
      ? await this.db.getRepository(Product).find({ where: { sku: In(skus) }, select: ['id', 'sku'] })
      : [];
    const idBySku = new Map(products.map((p) => [p.sku, p.id]));
    const touched = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = names[i];
      const ext = extname(name);
      if (!ALLOWED.has(ext)) {
        result.unmatched.push({ file: file.originalname, reason: `unsupported type ${ext || '(none)'}` });
        continue;
      }
      const hit = candidates[i].find((c) => idBySku.has(c.sku));
      if (!hit) {
        const why = mapByFile.has(name) ? `SKU ${mapByFile.get(name)!.sku} not found in products` : 'not in mapping sheet';
        result.unmatched.push({ file: file.originalname, reason: why });
        continue;
      }
      const productId = idBySku.get(hit.sku)!;
      const url = await this.storage.put(`products/${hit.sku.toLowerCase()}/${randomUUID()}${ext}`, file.buffer, file.mimetype);
      const repo = this.db.getRepository(ProductImage);
      const existing = await repo.findOne({ where: { productId, sourceFileName: name } });
      if (existing) {
        await this.storage.remove(existing.url);
        await repo.update({ id: existing.id }, { url, position: hit.position });
      } else {
        await repo.insert({ productId, url, position: hit.position, sourceFileName: name });
      }
      touched.add(productId);
      result.matched.push({ file: file.originalname, sku: hit.sku, position: hit.position });
    }
    await refreshThumbnails(this.db, [...touched]);
    return result;
  }
}
