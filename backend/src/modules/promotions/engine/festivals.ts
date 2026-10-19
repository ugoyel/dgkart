import { BASE_THEME } from './festival-calendar';
import { Festival, FestivalOccurrence, FestivalTheme, IsoDate } from './types';

const DAY = 86_400_000;

/** Start of an IST calendar day. */
export const istStart = (d: IsoDate): Date => new Date(`${d}T00:00:00+05:30`);
/** Last millisecond of an IST calendar day. */
export const istEnd = (d: IsoDate): Date => new Date(`${d}T23:59:59.999+05:30`);

/** `YYYY-MM-DD` of `now` in IST. */
export function istDate(now: Date): IsoDate {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** A saved edit to one festival. Unknown ids add a new festival. */
export type FestivalOverride = Partial<Omit<Festival, 'theme' | 'offerTemplate'>> & {
  id: string;
  theme?: Partial<FestivalTheme>;
  offerTemplate?: Partial<Festival['offerTemplate']>;
  /** Remove a default festival entirely. */
  deleted?: boolean;
};

/** Defaults with the admin's saved edits laid on top. */
export function mergeCalendar(defaults: Festival[], overrides: FestivalOverride[] = []): Festival[] {
  const byId = new Map(defaults.map((f) => [f.id, f]));
  for (const o of overrides) {
    if (o.deleted) {
      byId.delete(o.id);
      continue;
    }
    const base = byId.get(o.id);
    if (!base) {
      if (!o.name) continue; // a new festival needs at least a name
      byId.set(o.id, {
        greeting: o.name,
        tagline: '',
        dates: {},
        priority: 40,
        themeLeadDays: 5,
        themeTrailDays: 1,
        reminderWeeks: [4, 2, 1],
        enabled: true,
        ...o,
        name: o.name,
        theme: { ...BASE_THEME, ...o.theme },
        offerTemplate: { ...defaults[0]?.offerTemplate, ...o.offerTemplate } as Festival['offerTemplate'],
      });
      continue;
    }
    byId.set(o.id, {
      ...base,
      ...o,
      dates: { ...base.dates, ...o.dates },
      theme: { ...base.theme, ...o.theme },
      offerTemplate: { ...base.offerTemplate, ...o.offerTemplate },
    });
  }
  return [...byId.values()];
}

/** Every dated occurrence of the enabled festivals, sorted by start. */
export function occurrences(festivals: Festival[]): FestivalOccurrence[] {
  const out: FestivalOccurrence[] = [];
  for (const festival of festivals) {
    if (!festival.enabled) continue;
    for (const [year, d] of Object.entries(festival.dates ?? {})) {
      if (!d?.start || !d?.end) continue;
      const start = istStart(d.start);
      const end = istEnd(d.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
      out.push({
        festival,
        year,
        start,
        end,
        themeFrom: new Date(start.getTime() - festival.themeLeadDays * DAY),
        themeTo: new Date(end.getTime() + festival.themeTrailDays * DAY),
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The festival whose theme window contains `now` (highest priority wins). */
export function activeFestival(festivals: Festival[], now: Date): FestivalOccurrence | null {
  const t = now.getTime();
  const live = occurrences(festivals).filter((o) => o.themeFrom.getTime() <= t && t <= o.themeTo.getTime());
  if (!live.length) return null;
  live.sort((a, b) => b.festival.priority - a.festival.priority || Math.abs(a.start.getTime() - t) - Math.abs(b.start.getTime() - t));
  return live[0];
}

/** Festivals that have not ended yet, within `days` from now. */
export function upcomingFestivals(festivals: Festival[], now: Date, days = 120): FestivalOccurrence[] {
  const t = now.getTime();
  return occurrences(festivals).filter((o) => o.end.getTime() >= t && o.start.getTime() - t <= days * DAY);
}

export type FestivalPhase = 'lead-up' | 'live' | 'wind-down';

export interface ResolvedTheme {
  theme: FestivalTheme;
  occurrence: FestivalOccurrence | null;
  phase: FestivalPhase | null;
  /** Whole days until the festival starts (0 while it is on). */
  daysToStart: number;
  /** Everyday look, for "reset" previews. */
  base: FestivalTheme;
}

/** What the website should look like at `now`. */
export function resolveTheme(festivals: Festival[], now: Date, base: FestivalTheme = BASE_THEME): ResolvedTheme {
  const occ = activeFestival(festivals, now);
  if (!occ) return { theme: base, occurrence: null, phase: null, daysToStart: 0, base };
  const t = now.getTime();
  const phase: FestivalPhase = t < occ.start.getTime() ? 'lead-up' : t <= occ.end.getTime() ? 'live' : 'wind-down';
  const daysToStart = Math.max(0, Math.ceil((occ.start.getTime() - t) / DAY));
  return { theme: { ...base, ...occ.festival.theme }, occurrence: occ, phase, daysToStart, base };
}

/** Basic sanity checks for the admin calendar editor. */
export function validateFestival(f: Festival): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]{2,40}$/.test(f.id)) errors.push('Id must be 2-40 lowercase letters, digits or dashes');
  if (!f.name?.trim()) errors.push('Name is required');
  for (const [year, d] of Object.entries(f.dates ?? {})) {
    if (!/^\d{4}$/.test(year)) errors.push(`"${year}" is not a year`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start) || !/^\d{4}-\d{2}-\d{2}$/.test(d.end)) errors.push(`${year}: dates must be YYYY-MM-DD`);
    else if (d.end < d.start) errors.push(`${year}: end is before start`);
  }
  if (f.themeLeadDays < 0 || f.themeLeadDays > 60) errors.push('Theme lead days must be 0-60');
  if (f.reminderWeeks.some((w) => w < 0 || w > 26)) errors.push('Reminder weeks must be 0-26');
  return errors;
}
