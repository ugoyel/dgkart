import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../catalog/product.entity';
import { computeTotals } from '../orders/pricing';
import { CartItem } from './cart-item.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async get(userId: string) {
    const rows = await this.items.find({ where: { userId }, relations: { product: true }, order: { createdAt: 'ASC' } });
    const live = rows.filter((r) => r.product?.isActive);
    const totals = computeTotals(live.map((r) => ({ unitPrice: r.product!.price, quantity: r.quantity, freeShipping: r.product!.freeShipping })));
    return {
      items: live.map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        product: {
          id: r.product!.id, title: r.product!.title, price: r.product!.price, mrp: r.product!.mrp,
          thumbnailUrl: r.product!.thumbnailUrl, stock: r.product!.stock, condition: r.product!.condition,
          freeShipping: r.product!.freeShipping,
        },
      })),
      count: live.reduce((s, r) => s + r.quantity, 0),
      ...totals,
    };
  }

  async add(userId: string, productId: string, quantity: number) {
    const product = await this.products.findOne({ where: { id: productId, isActive: true } });
    if (!product) throw new NotFoundException('Product not found');
    const existing = await this.items.findOne({ where: { userId, productId } });
    const qty = (existing?.quantity ?? 0) + quantity;
    if (qty > product.stock) throw new BadRequestException(`Only ${product.stock} left in stock`);
    await this.items.save(existing ? { ...existing, quantity: qty } : this.items.create({ userId, productId, quantity: qty }));
    return this.get(userId);
  }

  async setQuantity(userId: string, productId: string, quantity: number) {
    if (quantity <= 0) return this.remove(userId, productId);
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (quantity > product.stock) throw new BadRequestException(`Only ${product.stock} left in stock`);
    await this.items.update({ userId, productId }, { quantity });
    return this.get(userId);
  }

  async remove(userId: string, productId: string) {
    await this.items.delete({ userId, productId });
    return this.get(userId);
  }

  async clear(userId: string) {
    await this.items.delete({ userId });
  }
}
