import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { AuthUser, CurrentUser } from '../../common/roles';
import { AddressDto } from '../users/users.controller';
import { PaymentMethod } from './order.entity';
import { OrdersService } from './orders.service';

class LineDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(99) quantity!: number;
}

class PlaceOrderDto {
  @ApiProperty({ type: AddressDto }) @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @ApiPropertyOptional({ type: [LineDto], description: 'Buy It Now items; omit to check out the cart' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LineDto) items?: LineDto[];
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post() place(@CurrentUser() u: AuthUser, @Body() dto: PlaceOrderDto) {
    return this.orders.place(u.id, dto);
  }

  @Get() mine(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.orders.mine(u.id, q);
  }

  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForUser(u.id, id);
  }
}
