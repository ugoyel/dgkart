import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product } from '../catalog/product.entity';
import { StorageService } from '../storage/storage.service';
import { ProductImage } from '../catalog/product-image.entity';
import { refreshThumbnails } from './import.service';

@Injectable()
export class AdminProductsService {
  constructor(private readonly db: DataSource, private readonly storage: StorageService) {}

  private get repo() {
    return this.db.getRepository(Product);
  }

  async create(data: Partial<Product>) {
    return this.repo.save(this.repo.create({ ...data, sku: data.sku!.trim().toUpperCase(), isDummy: false }));
  }

  async update(id: string, patch: Partial<Product>) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    Object.assign(p, patch, { id });
    return this.repo.save(p);
  }

  async remove(id: string) {
    const images = await this.db.getRepository(ProductImage).find({ where: { productId: id } });
    await this.repo.delete({ id });
    await Promise.all(images.map((i) => this.storage.remove(i.url)));
    return { deleted: true };
  }

  async removeImage(imageId: string) {
    const repo = this.db.getRepository(ProductImage);
    const img = await repo.findOne({ where: { id: imageId } });
    if (!img) throw new NotFoundException('Image not found');
    await repo.delete({ id: imageId });
    await this.storage.remove(img.url);
    await refreshThumbnails(this.db, [img.productId]);
    return { deleted: true };
  }

  async stats() {
    const [r] = await this.db.query(`
      SELECT
        (SELECT count(*)::int FROM products) AS products,
        (SELECT count(*)::int FROM products WHERE "isDummy") AS "dummyProducts",
        (SELECT count(*)::int FROM products WHERE "thumbnailUrl" IS NULL) AS "productsWithoutImages",
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM orders) AS orders,
        (SELECT COALESCE(sum(total), 0)::float FROM orders WHERE status IN ('PAID','CONFIRMED_COD','SHIPPED','DELIVERED')) AS revenue,
        (SELECT count(*)::int FROM image_mappings) AS "imageMappings"`);
    return r;
  }
}
