import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting, Promotion } from './promotion.entity';
import { AdminPromotionsController, PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, AppSetting])],
  providers: [PromotionsService],
  controllers: [PromotionsController, AdminPromotionsController],
  exports: [PromotionsService],
})
export class PromotionsModule {}
