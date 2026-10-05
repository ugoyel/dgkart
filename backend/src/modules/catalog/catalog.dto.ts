import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { ProductCondition } from './product.entity';

export const SORTS = ['best', 'price_asc', 'price_desc', 'newest'] as const;
export type Sort = (typeof SORTS)[number];

export class ProductSearchQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Free text search on title and brand' })
  @IsOptional() @IsString() @MaxLength(120) q?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;

  @ApiPropertyOptional({ enum: ProductCondition })
  @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() freeShipping?: boolean;

  @ApiPropertyOptional({ enum: SORTS, default: 'best' })
  @IsOptional() @IsIn(SORTS as unknown as string[]) sort: Sort = 'best';
}

/** Fields returned in list views (kept small for fast scrolling over large catalogs). */
export const LIST_FIELDS = [
  'id', 'sku', 'title', 'brand', 'price', 'mrp', 'condition', 'thumbnailUrl', 'freeShipping',
  'rating', 'reviewCount', 'soldCount', 'stock', 'categoryId',
] as const;
