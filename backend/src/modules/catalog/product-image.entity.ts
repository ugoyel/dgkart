import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_images')
@Index(['productId', 'position'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @ManyToOne(() => Product, (p) => p.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' }) product?: Product;
  @Column({ length: 600 }) url!: string;
  @Column({ default: 0 }) position!: number;
  /** Original uploaded file name (lower-cased) so re-uploads replace instead of duplicating. */
  @Column({ type: 'varchar', length: 255, nullable: true }) sourceFileName!: string | null;
}
