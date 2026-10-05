import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Page, PageQuery, toPage } from '../../common/pagination';
import { CartService } from '../cart/cart.service';
import { Product } from '../catalog/product.entity';
import { Address } from '../users/user.entity';
import { Order, OrderLine, OrderStatus, PaymentMethod } from './order.entity';
import { computeTotals } from './pricing';

export interface PlaceOrderInput {
  address: Address;
  paymentMethod: PaymentMethod;
  /** Optional "Buy It Now" lines; when omitted the user's cart is checked out. */
  items?: { productId: string; quantity: number }[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly cart: CartService,
    private readonly db: DataSource,
  ) {}

  async place(userId: string, input: PlaceOrderInput): Promise<Order> {
    const fromCart = !input.items?.length;
    const wanted = fromCart
      ? (await this.cart.get(userId)).items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      : input.items!;
    if (!wanted.length) throw new BadRequestException('Your cart is empty');

    const order = await this.db.transaction(async (tx) => {
      const products = await tx.getRepository(Product).find({ where: { id: In(wanted.map((w) => w.productId)), isActive: true } });
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines: OrderLine[] = [];
      const pricing = [];
      for (const w of wanted) {
        const p = byId.get(w.productId);
        if (!p) throw new BadRequestException('An item in your cart is no longer available');
        // Reserve stock atomically; fails if someone else bought the last unit.
        const res = await tx.query(
          'UPDATE products SET stock = stock - $1, "soldCount" = "soldCount" + $1 WHERE id = $2 AND stock >= $1',
          [w.quantity, p.id],
        );
        if (!res[1]) throw new BadRequestException(`"${p.title}" has only ${p.stock} left`);
        lines.push({ productId: p.id, sku: p.sku, title: p.title, imageUrl: p.thumbnailUrl, unitPrice: p.price, quantity: w.quantity });
        pricing.push({ unitPrice: p.price, quantity: w.quantity, freeShipping: p.freeShipping });
      }
      const totals = computeTotals(pricing);
      return tx.getRepository(Order).save(
        tx.getRepository(Order).create({
          orderNumber: newOrderNumber(),
          userId,
          items: lines,
          ...totals,
          shippingAddress: input.address,
          paymentMethod: input.paymentMethod,
          status: input.paymentMethod === PaymentMethod.COD ? OrderStatus.CONFIRMED_COD : OrderStatus.PENDING_PAYMENT,
          payment: {},
        }),
      );
    });

    if (fromCart) await this.cart.clear(userId);
    return order;
  }

  async mine(userId: string, q: PageQuery): Promise<Page<Order>> {
    const [items, total] = await this.orders.findAndCount({
      where: { userId }, order: { createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    });
    return toPage(items, total, q);
  }

  async getForUser(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async all(q: PageQuery, status?: OrderStatus): Promise<Page<Order>> {
    const [items, total] = await this.orders.findAndCount({
      where: status ? { status } : {}, order: { createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    });
    return toPage(items, total, q);
  }

  async setStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.db.transaction(async (tx) => {
      const order = await tx.getRepository(Order).findOne({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      const releasing = [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED].includes(status);
      const alreadyReleased = [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED].includes(order.status);
      if (releasing && !alreadyReleased) await this.releaseStock(tx, order);
      order.status = status;
      return tx.getRepository(Order).save(order);
    });
  }

  async markPaid(id: string, payment: Record<string, string>): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) return order; // idempotent (app callback + webhook)
    order.status = OrderStatus.PAID;
    order.payment = { ...order.payment, ...payment };
    return this.orders.save(order);
  }

  async attachGatewayOrder(id: string, payment: Record<string, string>) {
    await this.orders.update({ id }, { payment });
  }

  findByGatewayOrderId(gatewayOrderId: string) {
    return this.orders.createQueryBuilder('o').where(`o.payment->>'gatewayOrderId' = :g`, { g: gatewayOrderId }).getOne();
  }

  private async releaseStock(tx: EntityManager, order: Order) {
    for (const l of order.items) {
      await tx.query('UPDATE products SET stock = stock + $1, "soldCount" = GREATEST("soldCount" - $1, 0) WHERE id = $2', [l.quantity, l.productId]);
    }
  }
}

function newOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DG${stamp}${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
}
