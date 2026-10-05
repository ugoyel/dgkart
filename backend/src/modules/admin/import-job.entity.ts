import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ImportJobType = 'PRODUCTS' | 'IMAGE_MAPPING' | 'SEED';
export type ImportJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

@Entity('import_jobs')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 20 }) type!: ImportJobType;
  @Column({ type: 'varchar', length: 20, default: 'QUEUED' }) status!: ImportJobStatus;
  @Column({ type: 'varchar', length: 255, nullable: true }) fileName!: string | null;
  @Column({ default: 0 }) totalRows!: number;
  @Column({ default: 0 }) processedRows!: number;
  @Column({ default: 0 }) upsertedRows!: number;
  @Column({ default: 0 }) failedRows!: number;
  /** First 200 row-level errors, e.g. { row: 12, message: "price is not a number" }. */
  @Column({ type: 'jsonb', default: () => "'[]'" }) errors!: { row: number; message: string }[];
  @CreateDateColumn() createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt!: Date | null;
}
