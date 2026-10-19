import { Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser } from '../../common/roles';
import { WatchItem } from './watch-item.entity';

@ApiTags('watchlist')
@ApiBearerAuth()
@Controller('watchlist')
export class WatchlistController {
  constructor(@InjectRepository(WatchItem) private readonly repo: Repository<WatchItem>) {}

  @Get() async list(@CurrentUser() u: AuthUser) {
    const rows = await this.repo.find({ where: { userId: u.id }, relations: { product: true }, order: { createdAt: 'DESC' } });
    return rows.filter((r) => r.product).map((r) => r.product);
  }

  @Put(':productId') async add(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    await this.repo.upsert({ userId: u.id, productId }, ['userId', 'productId']);
    return { watching: true };
  }

  @Delete(':productId') async remove(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    await this.repo.delete({ userId: u.id, productId });
    return { watching: false };
  }
}
