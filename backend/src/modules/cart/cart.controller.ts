import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/roles';
import { CartService } from './cart.service';

class AddToCartDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) @Max(99) quantity = 1;
}

class QuantityDto {
  @ApiProperty() @IsInt() @Min(0) @Max(99) quantity!: number;
}

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get() get(@CurrentUser() u: AuthUser) {
    return this.cart.get(u.id);
  }

  @Post() add(@CurrentUser() u: AuthUser, @Body() dto: AddToCartDto) {
    return this.cart.add(u.id, dto.productId, dto.quantity);
  }

  @Patch(':productId') set(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) id: string, @Body() dto: QuantityDto) {
    return this.cart.setQuantity(u.id, id, dto.quantity);
  }

  @Delete(':productId') remove(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) id: string) {
    return this.cart.remove(u.id, id);
  }
}
