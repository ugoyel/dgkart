import { normalizePhone } from './configuration';

describe('normalizePhone', () => {
  it('treats all common spellings of the admin number as the same', () => {
    for (const p of ['9910123503', '+919910123503', '919910123503', '+91 99101 23503', '99101-23503']) {
      expect(normalizePhone(p)).toBe('+919910123503');
    }
  });
});
