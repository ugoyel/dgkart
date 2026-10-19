import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numeric } from '../../database/numeric.transformer';
import type { CardType, Discount, OfferKind, OfferScope } from './engine';

/** One offer (deal, coupon, bank offer or sale). Mirrors engine `Offer`. */
@Entity('promotions')
@Index(['isActive', 'endsAt'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 30 }) kind!: OfferKind;
  @Column({ length: 200 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'jsonb' }) discount!: Discount;
  @Column({ type: 'jsonb', default: () => "'{}'" }) scope!: OfferScope;
  @Column({ type: 'timestamptz' }) startsAt!: Date;
  @Column({ type: 'timestamptz' }) endsAt!: Date;
  @Column({ default: false }) isActive!: boolean;
  @Column({ type: 'int', nullable: true }) stockLimit!: number | null;
  @Column({ default: 0 }) claimedCount!: number;
  @Column({ type: 'int', nullable: true }) perUserLimit!: number | null;
  @Index() @Column({ type: 'varchar', length: 30, nullable: true }) code!: string | null;
  @Column({ default: false }) clip!: boolean;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numeric })
  minOrder!: number | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) bank!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) cardType!: CardType | null;
  @Index() @Column({ type: 'varchar', length: 40, nullable: true }) festivalId!: string | null;
  @Column({ type: 'varchar', length: 600, nullable: true }) bannerImage!: string | null;
  @Column({ default: 0 }) sortOrder!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

/** Small key/value store for admin settings (festival calendar edits, dismissed reminders). */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ length: 80 }) key!: string;
  @Column({ type: 'jsonb' }) value!: unknown;
  @UpdateDateColumn() updatedAt!: Date;
}
