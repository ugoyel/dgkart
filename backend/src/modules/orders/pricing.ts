/** Single place for checkout maths so the app, website and API always agree. */
export const FREE_SHIPPING_THRESHOLD = 499;
export const SHIPPING_FEE = 40;

export function computeTotals(lines: { unitPrice: number; quantity: number; freeShipping: boolean }[]) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const allFree = lines.length > 0 && lines.every((l) => l.freeShipping);
  const shippingFee = lines.length === 0 || allFree || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal, shippingFee, total: round2(subtotal + shippingFee) };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
