import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One row of the admin's mapping sheet: which image file belongs to which product. */
@Entity('image_mappings')
export class ImageMapping {
  /** Normalised (lower-case, trimmed) file name, e.g. "shoe-red-1.jpg". */
  @PrimaryColumn({ length: 255 }) fileName!: string;
  @Index() @Column({ length: 80 }) sku!: string;
  @Column({ default: 0 }) position!: number;
  @CreateDateColumn() createdAt!: Date;
}
