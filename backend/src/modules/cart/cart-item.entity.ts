import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../catalog/product.entity';

@Entity('cart_items')
@Index(['userId', 'productId'], { unique: true })
export class CartItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @ManyToOne(() => Product, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'productId' }) product?: Product;
  @Column({ default: 1 }) quantity!: number;
  @CreateDateColumn() createdAt!: Date;
}
