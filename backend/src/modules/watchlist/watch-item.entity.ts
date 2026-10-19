import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Product } from '../catalog/product.entity';

@Entity('watchlist')
export class WatchItem {
  @PrimaryColumn('uuid') userId!: string;
  @PrimaryColumn('uuid') productId!: string;
  @ManyToOne(() => Product, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'productId' }) product?: Product;
  @CreateDateColumn() createdAt!: Date;
}
