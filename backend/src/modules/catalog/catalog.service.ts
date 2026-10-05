import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Page, toPage } from '../../common/pagination';
import { LIST_FIELDS, ProductSearchQuery } from './catalog.dto';
import { Category } from './category.entity';
import { Product } from './product.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  private listQuery(): SelectQueryBuilder<Product> {
    return this.products
      .createQueryBuilder('p')
      .select(LIST_FIELDS.map((f) => `p.${f}`))
      .where('p.isActive = true');
  }

  async search(q: ProductSearchQuery): Promise<Page<Product>> {
    const qb = this.listQuery();
    if (q.q?.trim()) {
      qb.andWhere('(p.title ILIKE :t OR p.brand ILIKE :t OR p.sku = :exact)', { t: `%${q.q.trim()}%`, exact: q.q.trim() });
    }
    if (q.category) {
      const cat = await this.categories.findOne({ where: { slug: q.category } });
      if (!cat) return toPage([], 0, q);
      const children = await this.categories.find({ where: { parentId: cat.id } });
      qb.andWhere('p.categoryId IN (:...cats)', { cats: [cat.id, ...children.map((c) => c.id)] });
    }
    if (q.minPrice !== undefined) qb.andWhere('p.price >= :min', { min: q.minPrice });
    if (q.maxPrice !== undefined) qb.andWhere('p.price <= :max', { max: q.maxPrice });
    if (q.condition) qb.andWhere('p.condition = :cond', { cond: q.condition });
    if (q.freeShipping) qb.andWhere('p.freeShipping = true');

    switch (q.sort) {
      case 'price_asc': qb.orderBy('p.price', 'ASC'); break;
      case 'price_desc': qb.orderBy('p.price', 'DESC'); break;
      case 'newest': qb.orderBy('p.createdAt', 'DESC'); break;
      default: qb.orderBy('p.soldCount', 'DESC').addOrderBy('p.rating', 'DESC');
    }
    qb.addOrderBy('p.id', 'ASC');

    const [items, total] = await qb.skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return toPage(items, total, q);
  }

  /** Everything the home screen needs in one round trip. */
  async home() {
    const [categories, dailyDeals, trending, newArrivals] = await Promise.all([
      this.categories.find({ where: { parentId: IsNull() }, order: { sortOrder: 'ASC' } }),
      this.listQuery()
        .andWhere('p.mrp IS NOT NULL AND p.mrp > p.price')
        .orderBy('(p.mrp - p.price) / p.mrp', 'DESC')
        .take(12)
        .getMany(),
      this.listQuery().orderBy('p.soldCount', 'DESC').take(12).getMany(),
      this.listQuery().orderBy('p.createdAt', 'DESC').take(12).getMany(),
    ]);
    return { categories, dailyDeals, trending, newArrivals };
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'img')
      .leftJoinAndSelect('p.category', 'cat')
      .where('p.id = :id', { id })
      .orderBy('img.position', 'ASC')
      .getOne();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async similar(id: string): Promise<Product[]> {
    const p = await this.products.findOne({ where: { id }, select: ['id', 'categoryId'] });
    if (!p?.categoryId) return [];
    return this.listQuery()
      .andWhere('p.categoryId = :c AND p.id <> :id', { c: p.categoryId, id })
      .orderBy('p.soldCount', 'DESC')
      .take(12)
      .getMany();
  }
}
