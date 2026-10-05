import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { numeric } from '../../database/numeric.transformer';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';

export enum ProductCondition {
  NEW = 'NEW',
  OPEN_BOX = 'OPEN_BOX',
  REFURBISHED = 'REFURBISHED',
  USED = 'USED',
}

@Entity('products')
@Index(['isActive', 'createdAt'])
export class Product {
  @PrimaryGeneratedColumn('uuid') id!: string;
  /** Business key used by Excel import and the image mapping sheet. */
  @Index({ unique: true }) @Column({ length: 80 }) sku!: string;
  @Column({ length: 300 }) title!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) brand!: string | null;
  @Column({ type: 'enum', enum: ProductCondition, default: ProductCondition.NEW }) condition!: ProductCondition;
  @Index() @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numeric }) price!: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numeric }) mrp!: number | null;
  @Column({ default: 0 }) stock!: number;
  @Index() @Column({ type: 'uuid', nullable: true }) categoryId!: string | null;
  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' }) category?: Category | null;
  /** Free-form "item specifics" shown in the product page table. */
  @Column({ type: 'jsonb', default: () => "'{}'" }) specs!: Record<string, string>;
  @Column({ default: true }) freeShipping!: boolean;
  @Column({ type: 'real', default: 0 }) rating!: number;
  @Column({ default: 0 }) reviewCount!: number;
  @Column({ default: 0 }) soldCount!: number;
  /** Denormalised first image so list pages never join product_images. */
  @Column({ type: 'varchar', length: 600, nullable: true }) thumbnailUrl!: string | null;
  /** Seeded demo data; the admin can wipe all of it in one call. */
  @Index() @Column({ default: false }) isDummy!: boolean;
  @Column({ default: true }) isActive!: boolean;
  @OneToMany(() => ProductImage, (i) => i.product) images?: ProductImage[];
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
