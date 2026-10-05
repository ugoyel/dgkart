import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 80 }) slug!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) imageUrl!: string | null;
  @Column({ type: 'uuid', nullable: true }) parentId!: string | null;
  @Column({ default: 0 }) sortOrder!: number;
}
