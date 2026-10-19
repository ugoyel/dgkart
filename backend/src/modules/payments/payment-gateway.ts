import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export interface GatewayOrder {
  provider: 'razorpay' | 'mock';
  gatewayOrderId: string;
  /** Amount in the smallest currency unit (paise). */
  amount: number;
  currency: 'INR';
  /** Public key the client SDK needs (never the secret). */
  keyId?: string;
}

export interface PaymentConfirmation {
  gatewayOrderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Payment provider port. Razorpay today; Stripe, PayU, Cashfree, PhonePe etc.
 * can be added by implementing this class without touching orders or the app.
 */
export abstract class PaymentGateway {
  abstract readonly name: 'razorpay' | 'mock';
  abstract createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder>;
  abstract verify(c: PaymentConfirmation): boolean;
  abstract verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

export function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export class RazorpayGateway extends PaymentGateway {
  readonly name = 'razorpay' as const;

  constructor(private readonly keyId: string, private readonly keySecret: string, private readonly webhookSecret?: string) {
    super();
  }

  async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder> {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
      },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    });
    if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { id: string; amount: number };
    return { provider: 'razorpay', gatewayOrderId: body.id, amount: body.amount, currency: 'INR', keyId: this.keyId };
  }

  /** Razorpay checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
  verify(c: PaymentConfirmation): boolean {
    return safeEqual(hmacHex(this.keySecret, `${c.gatewayOrderId}|${c.paymentId}`), c.signature);
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqual(hmacHex(this.webhookSecret, rawBody), signature);
  }
}

/** Local/dev gateway: no money moves. The app shows a simulated payment sheet. */
export class MockGateway extends PaymentGateway {
  readonly name = 'mock' as const;

  async createOrder(amountPaise: number): Promise<GatewayOrder> {
    return { provider: 'mock', gatewayOrderId: `mock_${randomUUID()}`, amount: amountPaise, currency: 'INR' };
  }

  verify(c: PaymentConfirmation): boolean {
    return c.gatewayOrderId.startsWith('mock_') && c.signature === 'mock-success';
  }

  verifyWebhook(): boolean {
    return false;
  }
}
