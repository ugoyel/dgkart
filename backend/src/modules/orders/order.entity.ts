import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numeric } from '../../database/numeric.transformer';
import { Address } from '../users/user.entity';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CONFIRMED_COD = 'CONFIRMED_COD',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  ONLINE = 'ONLINE',
  COD = 'COD',
}

export interface OrderLine {
  productId: string;
  sku: string;
  title: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 30 }) orderNumber!: string;
  @Index() @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT }) status!: OrderStatus;
  @Column({ type: 'enum', enum: PaymentMethod }) paymentMethod!: PaymentMethod;
  @Column({ type: 'jsonb' }) items!: OrderLine[];
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numeric }) subtotal!: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numeric }) shippingFee!: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numeric }) total!: number;
  @Column({ type: 'jsonb' }) shippingAddress!: Address;
  /** Gateway identifiers, e.g. { provider, gatewayOrderId, paymentId }. */
  @Column({ type: 'jsonb', default: () => "'{}'" }) payment!: Record<string, string>;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
