import { DEFAULT_FESTIVALS, resolveTheme } from '@engine';
import { describe, expect, it } from 'vitest';
import { fromLocalInput, percentOff, toLocalInput } from './format';

describe('festival theme on the website', () => {
  it('switches to Diwali ahead of the festival and back to DGkart blue after', () => {
    expect(resolveTheme(DEFAULT_FESTIVALS, new Date('2026-11-07T12:00:00+05:30')).occurrence?.festival.id).toBe('diwali');
    expect(resolveTheme(DEFAULT_FESTIVALS, new Date('2026-12-01T12:00:00+05:30')).occurrence).toBeNull();
  });
});

describe('format helpers', () => {
  it('round-trips IST datetime inputs', () => {
    const iso = '2026-11-06T02:30:00.000Z';
    expect(toLocalInput(iso)).toBe('2026-11-06T08:00');
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });
  it('computes percent off', () => {
    expect(percentOff(750, 1000)).toBe(25);
    expect(percentOff(1000, null)).toBe(0);
  });
});
