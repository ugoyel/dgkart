import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/roles';
import { ProductSearchQuery } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home') home() {
    return this.catalog.home();
  }

  @Get('categories') categories() {
    return this.catalog.listCategories();
  }

  @Get('products') search(@Query() q: ProductSearchQuery) {
    return this.catalog.search(q);
  }

  @Get('products/:id') product(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(id);
  }

  @Get('products/:id/similar') similar(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.similar(id);
  }
}
