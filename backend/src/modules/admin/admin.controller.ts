import {
  BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
  StreamableFile, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { Public, Role, Roles } from '../../common/roles';
import { ProductCondition } from '../catalog/product.entity';
import { OrderStatus } from '../orders/order.entity';
import { OrdersService } from '../orders/orders.service';
import { AdminProductsService } from './admin-products.service';
import { ImageUploadService, UploadedFile as UFile } from './image-upload.service';
import { ImportService } from './import.service';
import { JobRunner } from './job-runner.service';
import { SeedService } from './seed.service';
import { mappingTemplate, productsTemplate } from './templates';

const SHEET_LIMIT = 50 * 1024 * 1024;
const IMAGE_LIMIT = 10 * 1024 * 1024;
const sheetFilter = (_: unknown, f: { originalname: string }, cb: (e: Error | null, ok: boolean) => void) =>
  /\.(xlsx|csv)$/i.test(f.originalname) ? cb(null, true) : cb(new BadRequestException('Upload an .xlsx or .csv file'), false);

class ProductDto {
  @ApiProperty() @IsString() @Length(1, 80) sku!: string;
  @ApiProperty() @IsString() @Length(1, 300) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiProperty() @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) mrp?: number;
  @ApiProperty() @IsInt() @Min(0) stock!: number;
  @ApiPropertyOptional({ enum: ProductCondition }) @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() freeShipping?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() specs?: Record<string, string>;
}
class UpdateProductDto extends PartialType(ProductDto) {}

class SeedDto {
  @ApiProperty({ default: 1000, maximum: 50000 }) @IsInt() @Min(1) @Max(50000) count = 1000;
}

class WipeAllDto {
  @ApiProperty({ description: 'Must be the word DELETE' }) @IsIn(['DELETE']) confirm!: string;
}

class StatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
}

class OrdersQuery extends PageQuery {
  @ApiPropertyOptional({ enum: OrderStatus }) @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
}

const fileBody = (field: string, many = false) => ({
  schema: {
    type: 'object',
    properties: { [field]: many ? { type: 'array', items: { type: 'string', format: 'binary' } } : { type: 'string', format: 'binary' } },
  },
});

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly imports: ImportService,
    private readonly images: ImageUploadService,
    private readonly seeds: SeedService,
    private readonly runner: JobRunner,
    private readonly products: AdminProductsService,
    private readonly orders: OrdersService,
  ) {}

  @Get('stats') stats() {
    return this.products.stats();
  }

  // ---- Bulk import -------------------------------------------------------

  @Post('import/products') @ApiConsumes('multipart/form-data') @ApiBody(fileBody('file'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SHEET_LIMIT }, fileFilter: sheetFilter }))
  importProducts(@UploadedFile() file?: UFile) {
    if (!file) throw new BadRequestException('Attach the products sheet as "file"');
    return this.imports.importProducts(file.buffer, file.originalname);
  }

  @Post('import/image-mapping') @ApiConsumes('multipart/form-data') @ApiBody(fileBody('file'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SHEET_LIMIT }, fileFilter: sheetFilter }))
  importMapping(@UploadedFile() file?: UFile) {
    if (!file) throw new BadRequestException('Attach the mapping sheet as "file"');
    return this.imports.importMapping(file.buffer, file.originalname);
  }

  /** Multi-file image upload. The app sends files in small batches and shows progress. */
  @Post('images') @HttpCode(200) @ApiConsumes('multipart/form-data') @ApiBody(fileBody('files', true))
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: IMAGE_LIMIT } }))
  uploadImages(@UploadedFiles() files: UFile[]) {
    if (!files?.length) throw new BadRequestException('Attach one or more images as "files"');
    return this.images.attach(files);
  }

  @Get('jobs') jobs() {
    return this.runner.recent();
  }

  @Get('jobs/:id') job(@Param('id', ParseUUIDPipe) id: string) {
    return this.runner.get(id);
  }

  @Public() @Get('templates/products.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="dgkart-products-template.xlsx"')
  async productsTemplate() {
    return new StreamableFile(await productsTemplate());
  }

  @Public() @Get('templates/image-mapping.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="dgkart-image-mapping-template.xlsx"')
  async mappingTemplate() {
    return new StreamableFile(await mappingTemplate());
  }

  // ---- Demo data ---------------------------------------------------------

  @Post('seed') seed(@Body() dto: SeedDto) {
    return this.seeds.enqueue(dto.count);
  }

  @Delete('products/dummy') wipeDummy() {
    return this.seeds.wipeDummy();
  }

  @Post('products/wipe-all') @HttpCode(200) wipeAll(@Body() _: WipeAllDto) {
    return this.seeds.wipeAll();
  }

  // ---- Products ----------------------------------------------------------

  @Post('products') create(@Body() dto: ProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }

  @Delete('images/:id') removeImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.removeImage(id);
  }

  // ---- Orders ------------------------------------------------------------

  @Get('orders') allOrders(@Query() q: OrdersQuery) {
    return this.orders.all(q, q.status);
  }

  @Patch('orders/:id/status') setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.orders.setStatus(id, dto.status);
  }
}
