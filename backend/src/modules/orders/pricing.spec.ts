import { computeTotals } from './pricing';

describe('computeTotals', () => {
  it('charges shipping under the free threshold unless every item ships free', () => {
    expect(computeTotals([{ unitPrice: 100, quantity: 2, freeShipping: false }])).toEqual({ subtotal: 200, shippingFee: 40, total: 240 });
    expect(computeTotals([{ unitPrice: 100, quantity: 2, freeShipping: true }])).toEqual({ subtotal: 200, shippingFee: 0, total: 200 });
    expect(computeTotals([{ unitPrice: 250, quantity: 2, freeShipping: false }]).shippingFee).toBe(0);
  });
});
