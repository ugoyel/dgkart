import { MockGateway, RazorpayGateway, hmacHex } from './payment-gateway';

describe('RazorpayGateway.verify', () => {
  const g = new RazorpayGateway('rzp_test_key', 'secret', 'whsec');

  it('accepts the signature Razorpay computes', () => {
    const signature = hmacHex('secret', 'order_1|pay_1');
    expect(g.verify({ gatewayOrderId: 'order_1', paymentId: 'pay_1', signature })).toBe(true);
  });

  it('rejects tampered payments', () => {
    const signature = hmacHex('secret', 'order_1|pay_1');
    expect(g.verify({ gatewayOrderId: 'order_1', paymentId: 'pay_2', signature })).toBe(false);
  });

  it('verifies webhooks against the raw body', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(g.verifyWebhook(body, hmacHex('whsec', body))).toBe(true);
    expect(g.verifyWebhook(body, 'nope')).toBe(false);
  });
});

describe('MockGateway', () => {
  it('only accepts its own success token', () => {
    const g = new MockGateway();
    expect(g.verify({ gatewayOrderId: 'mock_1', paymentId: 'p', signature: 'mock-success' })).toBe(true);
    expect(g.verify({ gatewayOrderId: 'order_1', paymentId: 'p', signature: 'mock-success' })).toBe(false);
  });
});
