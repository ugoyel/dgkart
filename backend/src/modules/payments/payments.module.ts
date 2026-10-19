import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';
import { MockGateway, PaymentGateway, RazorpayGateway } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule],
  providers: [
    PaymentsService,
    {
      provide: PaymentGateway,
      inject: [ConfigService],
      useFactory: (c: ConfigService): PaymentGateway => {
        const id = c.get<string>('razorpayKeyId');
        const secret = c.get<string>('razorpayKeySecret');
        if (c.get('paymentProvider') === 'razorpay' && id && secret) {
          return new RazorpayGateway(id, secret, c.get<string>('razorpayWebhookSecret'));
        }
        new Logger('Payments').warn('Using MOCK payment gateway (set PAYMENT_PROVIDER=razorpay + keys for real payments)');
        return new MockGateway();
      },
    },
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
