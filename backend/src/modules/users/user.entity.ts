import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../common/roles';

export interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true, length: 20 }) phone!: string;
  @Column({ nullable: true, type: 'varchar', length: 120 }) name!: string | null;
  @Column({ nullable: true, type: 'varchar', length: 200 }) email!: string | null;
  @Column({ type: 'enum', enum: Role, default: Role.USER }) role!: Role;
  @Column({ type: 'jsonb', default: () => "'[]'" }) addresses!: Address[];
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
