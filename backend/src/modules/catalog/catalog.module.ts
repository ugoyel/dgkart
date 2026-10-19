import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';
import { Product } from './product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, ProductImage])],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
