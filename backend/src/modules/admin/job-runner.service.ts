import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportJob, ImportJobType } from './import-job.entity';

export type JobHandler = (job: ImportJob, progress: (p: Partial<ImportJob>) => Promise<void>) => Promise<void>;

/**
 * Runs long admin jobs (imports, seeding) one at a time in the background and
 * records progress in the import_jobs table, which the app polls.
 *
 * In-process is enough for a single API instance. When you scale to several
 * instances, swap this class for a BullMQ/Redis or SQS-backed queue with the
 * same enqueue() signature; callers do not change.
 */
@Injectable()
export class JobRunner {
  private readonly log = new Logger(JobRunner.name);
  private chain: Promise<void> = Promise.resolve();

  constructor(@InjectRepository(ImportJob) private readonly jobs: Repository<ImportJob>) {}

  async enqueue(type: ImportJobType, fileName: string | null, handler: JobHandler): Promise<ImportJob> {
    const job = await this.jobs.save(this.jobs.create({ type, fileName, status: 'QUEUED', errors: [] }));
    this.chain = this.chain.then(() => this.run(job, handler));
    return job;
  }

  private async run(job: ImportJob, handler: JobHandler) {
    const progress = async (p: Partial<ImportJob>) => {
      Object.assign(job, p);
      await this.jobs.update({ id: job.id }, p as never);
    };
    const started = Date.now();
    try {
      await progress({ status: 'RUNNING' });
      await handler(job, progress);
      await progress({ status: 'DONE', finishedAt: new Date() });
      this.log.log(`${job.type} job ${job.id} done: ${job.upsertedRows} rows in ${Date.now() - started}ms`);
    } catch (e) {
      this.log.error(`${job.type} job ${job.id} failed`, (e as Error).stack);
      await progress({
        status: 'FAILED',
        finishedAt: new Date(),
        errors: [...job.errors, { row: 0, message: (e as Error).message }].slice(0, 200),
      });
    }
  }

  get(id: string) {
    return this.jobs.findOne({ where: { id } });
  }

  recent() {
    return this.jobs.find({ order: { createdAt: 'DESC' }, take: 20 });
  }
}
