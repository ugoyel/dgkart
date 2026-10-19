import { describe, expect, it } from 'vitest';
import { compact, money } from './format';

describe('format', () => {
  it('writes compact counts the Indian way', () => {
    expect(compact(950)).toBe('950');
    expect(compact(2900)).toBe('2.9K');
    expect(compact(120_000)).toBe('1.2L');
    expect(compact(34_000_000)).toBe('3.4Cr');
  });
  it('shows paise with two digits only when present', () => {
    expect(money(1299)).toBe('₹1,299');
    expect(money(14818.3)).toBe('₹14,818.30');
  });
});
