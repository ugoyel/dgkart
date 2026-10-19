import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { AdminProductsService } from './admin-products.service';
import { AdminController } from './admin.controller';
import { ImageMapping } from './image-mapping.entity';
import { ImageUploadService } from './image-upload.service';
import { ImportJob } from './import-job.entity';
import { ImportService } from './import.service';
import { JobRunner } from './job-runner.service';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportJob, ImageMapping]), OrdersModule],
  providers: [JobRunner, ImportService, ImageUploadService, SeedService, AdminProductsService],
  controllers: [AdminController],
  exports: [SeedService],
})
export class AdminModule {}
