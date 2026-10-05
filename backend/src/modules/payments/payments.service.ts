import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Order, OrderStatus, PaymentMethod } from '../orders/order.entity';
import { OrdersService } from '../orders/orders.service';
import { PaymentConfirmation, PaymentGateway } from './payment-gateway';

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(private readonly gateway: PaymentGateway, private readonly orders: OrdersService) {}

  async checkout(userId: string, orderId: string) {
    const order = await this.orders.getForUser(userId, orderId);
    this.assertPayable(order);
    const g = await this.gateway.createOrder(Math.round(order.total * 100), order.orderNumber, { orderId: order.id });
    await this.orders.attachGatewayOrder(order.id, { provider: g.provider, gatewayOrderId: g.gatewayOrderId });
    return { ...g, orderId: order.id, orderNumber: order.orderNumber, brand: 'DKKart' };
  }

  async confirm(userId: string, orderId: string, c: PaymentConfirmation): Promise<Order> {
    const order = await this.orders.getForUser(userId, orderId);
    if (order.status === OrderStatus.PAID) return order;
    if (order.payment?.gatewayOrderId !== c.gatewayOrderId) throw new BadRequestException('Payment does not match this order');
    if (!this.gateway.verify(c)) {
      await this.orders.setStatus(order.id, OrderStatus.PAYMENT_FAILED);
      throw new ForbiddenException('Payment signature verification failed');
    }
    return this.orders.markPaid(order.id, { paymentId: c.paymentId });
  }

  async fail(userId: string, orderId: string): Promise<Order> {
    const order = await this.orders.getForUser(userId, orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) return order;
    return this.orders.setStatus(order.id, OrderStatus.PAYMENT_FAILED);
  }

  /** Server-to-server confirmation; covers users who close the app right after paying. */
  async webhook(rawBody: Buffer, signature: string) {
    if (!this.gateway.verifyWebhook(rawBody, signature)) throw new ForbiddenException('Bad webhook signature');
    const evt = JSON.parse(rawBody.toString('utf8'));
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
      const p = evt.payload?.payment?.entity;
      const order = p?.order_id ? await this.orders.findByGatewayOrderId(p.order_id) : null;
      if (order) await this.orders.markPaid(order.id, { paymentId: p.id });
      else this.log.warn(`Webhook for unknown gateway order ${p?.order_id}`);
    }
    return { ok: true };
  }

  private assertPayable(order: Order) {
    if (order.paymentMethod !== PaymentMethod.ONLINE) throw new BadRequestException('This order is cash on delivery');
    if (order.status !== OrderStatus.PENDING_PAYMENT) throw new BadRequestException(`Order is ${order.status}`);
  }
}
