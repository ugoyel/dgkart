import { Body, Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../../common/roles';
import { PaymentsService } from './payments.service';

class CheckoutDto {
  @ApiProperty() @IsUUID() orderId!: string;
}

class ConfirmDto extends CheckoutDto {
  @ApiProperty() @IsString() gatewayOrderId!: string;
  @ApiProperty() @IsString() paymentId!: string;
  @ApiProperty() @IsString() signature!: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth() @Post('checkout') @HttpCode(200)
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.payments.checkout(u.id, dto.orderId);
  }

  @ApiBearerAuth() @Post('confirm') @HttpCode(200)
  confirm(@CurrentUser() u: AuthUser, @Body() dto: ConfirmDto) {
    return this.payments.confirm(u.id, dto.orderId, dto);
  }

  @ApiBearerAuth() @Post('fail') @HttpCode(200)
  fail(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.payments.fail(u.id, dto.orderId);
  }

  @Public() @Post('webhook/razorpay') @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') sig: string) {
    return this.payments.webhook(req.rawBody ?? Buffer.from(''), sig ?? '');
  }
}
