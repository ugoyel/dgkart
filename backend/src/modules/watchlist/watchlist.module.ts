import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchItem } from './watch-item.entity';
import { WatchlistController } from './watchlist.controller';

@Module({ imports: [TypeOrmModule.forFeature([WatchItem])], controllers: [WatchlistController] })
export class WatchlistModule {}
