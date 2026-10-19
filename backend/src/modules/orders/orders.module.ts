import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart/cart.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { Order } from './order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), CartModule, PromotionsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
